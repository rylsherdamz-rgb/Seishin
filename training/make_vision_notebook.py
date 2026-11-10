#!/usr/bin/env python3
"""
Builds seishin_vision_colab.ipynb — a self-contained Google Colab notebook that
fine-tunes a multimodal (image + text) tool-calling model for Seishin and exports
the two files llama.rn needs: the model GGUF and its vision projector (mmproj).

    python3 make_vision_notebook.py   # rerun after editing the generators or tools.json
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
cells: list[dict] = []


def md(src: str) -> None:
    cells.append({"cell_type": "markdown", "metadata": {}, "source": src.strip("\n").splitlines(keepends=True)})


def code(src: str) -> None:
    cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
                  "source": src.strip("\n").splitlines(keepends=True)})


md("""
# Seishin Vision Agent — multimodal on-device tool-calling model

Fine-tunes **Qwen3-VL-2B-Instruct** so Seishin's on-device agent can *see* the photos you attach —
posters, bills, assignment sheets, class schedules, chat screenshots, handwritten notes — and turn
them into events, tasks and notes with the app's real tools (`add_event`, `add_todo`, `add_note`, …),
while keeping all the text-only tool calling.

**How to run:** `Runtime → Change runtime type → GPU` (T4 works; L4/A100 is ~3× faster), then `Runtime → Run all`.

1. Renders ~1.2k synthetic photos + conversations (plus text-only chats) from the app's real tool schemas
2. LoRA fine-tunes the language layers (the vision encoder stays frozen — it already reads text well)
3. Early stopping per round, then accuracy-gated extra rounds on fresh data until it hits the target
4. Exports **two files** — `seishin-vision-Q4_K_M.gguf` (~1.1 GB) and `mmproj-seishin-vision-Q8_0.gguf`
   (~0.45 GB) — and smoke-tests them with a real image through llama.cpp's server (`--jinja --mmproj`),
   the same code llama.rn runs on the phone

On the phone: Settings → On-device model → pick the model `.gguf`, then **Vision projector** → pick the `mmproj` file.
""")

code("""
# ── Settings ────────────────────────────────────────────────────────────────
BASE_MODEL   = "unsloth/Qwen3-VL-2B-Instruct"
OUT_NAME     = "seishin-vision"
TRAIN_N      = 1200      # image conversations per round (+40% text-only ones)
EVAL_N       = 120
MAX_EPOCHS   = 2         # round 1; early stopping usually ends sooner
TARGET_ACC   = 0.90      # keep training until exact tool-call accuracy reaches this…
MAX_ROUNDS   = 3         # …or this many rounds have run
EVAL_SAMPLES = 120
QUANT        = "Q4_K_M"
SAVE_TO_DRIVE = True
""")

code("""
%%capture
!pip install -q unsloth   # pulls matching torch / transformers / trl / peft versions
# More fonts → more varied synthetic photos (any that are missing are skipped).
!for p in fonts-dejavu-core fonts-freefont-ttf fonts-liberation fonts-roboto fonts-inter fonts-comic-neue fonts-noto-mono; do apt-get -qq install -y $p >/dev/null 2>&1 || true; done
""")

md("## 1 · Dataset")
code("%%writefile tools.json\n" + (HERE / "tools.json").read_text())
code("%%writefile generate_dataset.py\n" + (HERE / "generate_dataset.py").read_text())
code("%%writefile generate_vision_dataset.py\n" + (HERE / "generate_vision_dataset.py").read_text())
code("""
!python3 generate_vision_dataset.py --train $TRAIN_N --eval $EVAL_N --seed 11 --out data_vision
import json
from PIL import Image
from IPython.display import display

def load_rows(path, img_dir):
    rows = [json.loads(l) for l in open(path)]
    for r in rows:
        r["image_paths"] = [f"{img_dir}/{p}" for p in r.get("images", [])]
    return rows

train_rows = load_rows("data_vision/train.jsonl", "data_vision/images")
eval_rows  = load_rows("data_vision/eval.jsonl", "data_vision/images")
ex = next(r for r in train_rows if r["image_paths"])
display(Image.open(ex["image_paths"][0]).resize((256, 256)))
print(json.dumps(ex["messages"][1:], indent=1, ensure_ascii=False)[:1500])
""")

md("## 2 · Model")
code("""
import torch
from unsloth import FastVisionModel
model, processor = FastVisionModel.from_pretrained(BASE_MODEL, load_in_4bit=False, use_gradient_checkpointing="unsloth")
model = FastVisionModel.get_peft_model(
    model, finetune_vision_layers=False, finetune_language_layers=True,
    finetune_attention_modules=True, finetune_mlp_modules=True,
    r=16, lora_alpha=16, lora_dropout=0, bias="none", random_state=7,
)
tok = processor.tokenizer if hasattr(processor, "tokenizer") else processor
CHAT_TEMPLATE = getattr(processor, "chat_template", None) or tok.chat_template
MAX_LEN = 4096  # the app runs llama.rn with n_ctx 4096

def render(row, upto=None, gen_prompt=False):
    # Rendered with plain dicts (not a datasets.Dataset), so tool-call arguments keep exactly their own keys.
    msgs = row["messages"] if upto is None else row["messages"][:upto]
    return tok.apply_chat_template(msgs, tools=row["tools"], chat_template=CHAT_TEMPLATE,
                                   tokenize=False, add_generation_prompt=gen_prompt)

def images_of(row):
    return [Image.open(p).convert("RGB") for p in row["image_paths"]]

ASSIST = tok.encode("<|im_start|>assistant\\n", add_special_tokens=False)
IM_END = tok.convert_tokens_to_ids("<|im_end|>")

def assistant_labels(ids):
    # Learn only assistant turns (tool calls + replies); system, user, images and tool results are masked.
    labels, i, n = [-100] * len(ids), 0, len(ASSIST)
    while i < len(ids):
        if ids[i:i + n] == ASSIST:
            j = i + n
            while j < len(ids) and ids[j] != IM_END:
                j += 1
            labels[i + n:j + 1] = ids[i + n:j + 1]
            i = j
        i += 1
    return labels

def collate(batch):
    texts, imgs = [render(r) for r in batch], [im for r in batch for im in images_of(r)]
    enc = processor(text=texts, images=imgs or None, return_tensors="pt", padding=True)
    labels = torch.tensor([assistant_labels(x.tolist()) for x in enc["input_ids"]])
    labels[enc["attention_mask"] == 0] = -100
    enc["labels"] = labels
    return enc

b = collate([ex])
print("tokens:", b["input_ids"].shape[1], "| trained tokens:", int((b["labels"] != -100).sum()))
print(tok.decode([t for t in b["labels"][0].tolist() if t != -100]))
""")

md("## 3 · Accuracy check (generates, parses `<tool_call>` blocks, compares to ground truth)")
code("""
import re
CALL_RE = re.compile(r"<tool_call>\\s*(\\{.*?\\})\\s*</tool_call>", re.S)

def parse_calls(text):
    out = []
    for m in CALL_RE.finditer(text):
        try:
            c = json.loads(m.group(1)); out.append((c.get("name"), c.get("arguments") or {}))
        except json.JSONDecodeError:
            out.append(("<bad json>", {}))
    return out

def norm(v):
    if isinstance(v, str): return v.strip().lower()
    if isinstance(v, list): return [norm(x) for x in v]
    return v

def same_args(a, b):
    return isinstance(a, dict) and set(a) == set(b) and all(norm(a[k]) == norm(b[k]) for k in b)

@torch.no_grad()
def evaluate(rows, n=EVAL_SAMPLES, batch=8, show=4):
    FastVisionModel.for_inference(model); tok.padding_side = "left"
    cases = [(r, i, m) for r in rows[:n] for i, m in enumerate(r["messages"]) if m["role"] == "assistant"]
    st = {k: 0 for k in ("tool", "name", "exact", "none", "none_ok", "img_tool", "img_exact")}
    misses = []
    for s in range(0, len(cases), batch):
        chunk = cases[s:s + batch]
        enc = processor(text=[render(r, upto=i, gen_prompt=True) for r, i, _ in chunk],
                        images=[im for r, _, _ in chunk for im in images_of(r)] or None,
                        return_tensors="pt", padding=True).to("cuda")
        gen = model.generate(**enc, max_new_tokens=320, do_sample=False, pad_token_id=tok.pad_token_id)
        for (r, i, want), g in zip(chunk, gen):
            text = tok.decode(g[enc["input_ids"].shape[1]:], skip_special_tokens=False).split("<|im_end|>")[0]
            got = parse_calls(text)
            exp = [(c["function"]["name"], c["function"]["arguments"]) for c in want.get("tool_calls", [])]
            if exp:
                names = [x[0] for x in got] == [e[0] for e in exp]
                ok = names and all(same_args(x[1], e[1]) for x, e in zip(got, exp))
                st["tool"] += 1; st["name"] += names; st["exact"] += ok
                if r["image_paths"]: st["img_tool"] += 1; st["img_exact"] += ok
            else:
                ok = not got; st["none"] += 1; st["none_ok"] += ok
            if not ok and len(misses) < show:
                misses.append((r["scenario"], exp or want["content"], text.strip()[:300]))
    res = {"tool_name_acc": st["name"] / max(st["tool"], 1), "tool_exact_acc": st["exact"] / max(st["tool"], 1),
           "image_exact_acc": st["img_exact"] / max(st["img_tool"], 1), "no_tool_acc": st["none_ok"] / max(st["none"], 1)}
    print({k: round(v, 3) for k, v in res.items()})
    for scen, exp, got in misses:
        print(f"  ✗ [{scen}] expected {exp}\\n    got {got!r}")
    FastVisionModel.for_training(model); tok.padding_side = "right"
    return res

print("Base model, before training:")
base_scores = evaluate(eval_rows, n=40)
""")

md("## 4 · Train until done")
code("""
import subprocess
from dataclasses import fields
from trl import SFTTrainer, SFTConfig
from transformers import EarlyStoppingCallback

_cfg = {f.name for f in fields(SFTConfig)}
LEN_ARG = "max_seq_length" if "max_seq_length" in _cfg else "max_length"  # renamed in newer TRL
bf16 = torch.cuda.is_bf16_supported()

def make_trainer(train, evals, epochs, lr):
    FastVisionModel.for_training(model)
    return SFTTrainer(
        model=model, processing_class=processor, data_collator=collate,
        train_dataset=train, eval_dataset=evals,
        args=SFTConfig(
            per_device_train_batch_size=2, gradient_accumulation_steps=8, per_device_eval_batch_size=2,
            num_train_epochs=epochs, learning_rate=lr, lr_scheduler_type="cosine", warmup_ratio=0.05,
            weight_decay=0.01, optim="adamw_8bit", seed=7, fp16=not bf16, bf16=bf16,
            logging_steps=5, eval_strategy="steps", eval_steps=25, save_strategy="steps", save_steps=25,
            save_total_limit=2, load_best_model_at_end=True, metric_for_best_model="eval_loss",
            output_dir="checkpoints", report_to="none",
            remove_unused_columns=False, dataset_text_field="", dataset_kwargs={"skip_prepare_dataset": True},
            **{LEN_ARG: MAX_LEN},
        ),
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3, early_stopping_threshold=0.001)],
    )

eval_loss_rows = eval_rows[:80]
history = []
for rnd in range(1, MAX_ROUNDS + 1):
    if rnd > 1:  # fresh, unseen photos and conversations
        subprocess.run(["python3", "generate_vision_dataset.py", "--train", str(TRAIN_N // 2), "--eval", "8",
                        "--seed", str(100 + rnd), "--out", f"data_vision_r{rnd}"], check=True)
        train_rows = load_rows(f"data_vision_r{rnd}/train.jsonl", f"data_vision_r{rnd}/images")
    print(f"\\n══ Round {rnd}: {len(train_rows)} conversations ══")
    make_trainer(train_rows, eval_loss_rows, MAX_EPOCHS if rnd == 1 else 1, 2e-4 if rnd == 1 else 5e-5).train()
    scores = evaluate(eval_rows)
    history.append(scores)
    if scores["tool_exact_acc"] >= TARGET_ACC and scores["no_tool_acc"] >= 0.85:
        print(f"Target reached in round {rnd}."); break
else:
    print("Round limit reached — last scores:", history[-1], "(raise MAX_ROUNDS to keep going)")
""")

code("""
# Try it on a fresh photo
import random, datetime, generate_vision_dataset as V
rng = random.Random(2024); now = datetime.datetime.now().replace(second=0, microsecond=0)
img, facts = V.img_poster(rng, now); img = V.photo_effects(img, rng); img.save("try.jpg"); display(img.resize((256, 256)))
row = {"tools": eval_rows[0]["tools"], "image_paths": ["try.jpg"], "messages": [
    {"role": "system", "content": V.G.system_prompt(now)},
    {"role": "user", "content": [{"type": "image"}, {"type": "text", "text": "add this to my calendar"}]}]}
FastVisionModel.for_inference(model)
enc = processor(text=[render(row, gen_prompt=True)], images=images_of(row), return_tensors="pt").to("cuda")
out = model.generate(**enc, max_new_tokens=200, do_sample=False)
print(tok.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=False))
print("truth:", facts["title"], facts["start"], facts["venue"])
""")

md("## 5 · Export: model GGUF + vision projector (mmproj) for llama.rn")
code("""
model.save_pretrained(f"{OUT_NAME}-lora"); processor.save_pretrained(f"{OUT_NAME}-lora")
model.save_pretrained_merged("merged", processor, save_method="merged_16bit")
""")
code("""
%%bash
set -e
[ -d llama.cpp ] || git clone -q --depth 1 https://github.com/ggml-org/llama.cpp
pip install -q ./llama.cpp/gguf-py
python llama.cpp/convert_hf_to_gguf.py merged --outfile seishin-vision-F16.gguf --outtype f16
python llama.cpp/convert_hf_to_gguf.py merged --mmproj --outfile mmproj-seishin-vision-Q8_0.gguf --outtype q8_0
cmake -S llama.cpp -B llama.cpp/build -DLLAMA_CURL=OFF -DCMAKE_BUILD_TYPE=Release > /dev/null
cmake --build llama.cpp/build --target llama-quantize llama-server -j "$(nproc)" > /dev/null
""")
code("""
import glob, os, shutil, subprocess
GGUF = f"{OUT_NAME}-{QUANT}.gguf"
subprocess.run(["llama.cpp/build/bin/llama-quantize", f"{OUT_NAME}-F16.gguf", GGUF, QUANT], check=True)
MMPROJ = sorted(glob.glob("*mmproj*.gguf"))[0]
for f in (GGUF, MMPROJ):
    print(f, f"{os.path.getsize(f) / 1e6:.0f} MB")
""")

md("### Smoke test — llama.cpp server with `--jinja --mmproj` (the path llama.rn uses), real image + tools")
code("""
import base64, time, requests
proc = subprocess.Popen(["llama.cpp/build/bin/llama-server", "-m", GGUF, "--mmproj", MMPROJ, "--jinja",
                         "-c", "4096", "--port", "8089"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
try:
    for _ in range(120):
        try:
            if requests.get("http://127.0.0.1:8089/health", timeout=1).ok: break
        except requests.RequestException: pass
        time.sleep(1)
    tools = json.load(open("tools.json"))
    def chat(content):
        r = requests.post("http://127.0.0.1:8089/v1/chat/completions", timeout=600, json={
            "messages": [{"role": "system", "content": V.G.system_prompt(now)}, {"role": "user", "content": content}],
            "tools": tools, "tool_choice": "auto", "temperature": 0.3}).json()
        m = r["choices"][0]["message"]
        return [(c["function"]["name"], c["function"]["arguments"]) for c in m.get("tool_calls") or []], m.get("content")
    for kind in (V.img_bill, V.img_assignment, V.img_chat):
        img, facts = kind(rng, now); img.save("smoke.jpg")
        url = "data:image/jpeg;base64," + base64.b64encode(open("smoke.jpg", "rb").read()).decode()
        print(facts["kind"], "→", chat([{"type": "image_url", "image_url": {"url": url}}, {"type": "text", "text": "add this"}]))
    print("text →", chat("add team standup tomorrow at 9am"))
finally:
    proc.terminate()
""")
code("""
if SAVE_TO_DRIVE:
    from google.colab import drive
    drive.mount("/content/drive")
    os.makedirs("/content/drive/MyDrive/seishin", exist_ok=True)
    for f in (GGUF, MMPROJ):
        shutil.copy(f, "/content/drive/MyDrive/seishin/")
    shutil.copytree(f"{OUT_NAME}-lora", f"/content/drive/MyDrive/seishin/{OUT_NAME}-lora", dirs_exist_ok=True)
    print("Saved to Drive: MyDrive/seishin/", GGUF, MMPROJ)
from google.colab import files
files.download(MMPROJ)
files.download(GGUF)   # ~1.1 GB — if the browser download stalls, grab it from Drive instead
""")

md("""
## On the phone
1. Copy both files to the device (Drive app → download, or USB).
2. Seishin → **Settings → AI · on-device first → On-device model** → pick `seishin-vision-Q4_K_M.gguf` → Save.
3. Below it, **Vision projector** → pick `mmproj-seishin-vision-Q8_0.gguf`.
4. In the Agent tab, attach a photo and type e.g. *"add this to my calendar"*.

Needs ~1.8 GB free RAM while loaded. Without the projector the same model still works text-only.
""")

nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"gpuType": "T4", "provenance": []},
                                   "kernelspec": {"display_name": "Python 3", "name": "python3"},
                                   "language_info": {"name": "python"}},
      "nbformat": 4, "nbformat_minor": 0}
out = HERE / "seishin_vision_colab.ipynb"
out.write_text(json.dumps(nb, indent=1, ensure_ascii=False) + "\n")
print(f"wrote {out}")

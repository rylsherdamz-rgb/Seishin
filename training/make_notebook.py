#!/usr/bin/env python3
"""
Builds seishin_agent_colab.ipynb — a self-contained Google Colab notebook that
generates the dataset, fine-tunes the model, checks it, and exports a GGUF for
llama.rn. The generator and tool schemas are embedded, so "Runtime → Run all"
works with nothing uploaded.

    python3 make_notebook.py      # rerun after editing generate_dataset.py or tools.json
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
# Seishin Agent — fine-tune a fast on-device tool-calling model

Trains a small model to drive Seishin's on-device agent: the same 15 tools
(`add_event`, `add_todo`, `add_note`, `list_*`, `update_*`, `delete_*`,
`complete_todo`, `list_inbox`, `remember_entity`, `recall_memory`) and the same
system prompt as `src/services/local-agent.ts`, so it slots straight into the app.

**How to run:** `Runtime → Change runtime type → T4 GPU` (free tier is fine), then `Runtime → Run all`.

1. Generates ~3k synthetic conversations from the app's real tool schemas
2. LoRA fine-tunes **Qwen2.5-0.5B-Instruct** (fast on 4 GB phones) — switch to 1.5B below for higher accuracy
3. Trains with early stopping, then measures tool-call accuracy on held-out data and
   keeps training on fresh data until it reaches the target (or the round limit)
4. Exports `seishin-agent-Q4_K_M.gguf`, smoke-tests it through llama.cpp's own
   tool-call parser (the one llama.rn uses), saves it to Google Drive and downloads it

Then copy the `.gguf` to the phone and pick it in **Settings → On-device model**.
""")

code("""
# ── Settings ────────────────────────────────────────────────────────────────
BASE_MODEL   = "unsloth/Qwen2.5-0.5B-Instruct"   # fastest. Better accuracy: "unsloth/Qwen2.5-1.5B-Instruct"
OUT_NAME     = "seishin-agent"
TRAIN_N      = 3000      # synthetic train conversations per round
EVAL_N       = 300
MAX_EPOCHS   = 3         # per round; early stopping usually ends sooner
TARGET_ACC   = 0.92      # keep training until exact tool-call accuracy reaches this…
MAX_ROUNDS   = 3         # …or this many rounds have run
EVAL_SAMPLES = 200       # conversations scored per accuracy check
QUANT        = "q4_k_m"  # GGUF quantization (q8_0 = bigger, slightly better)
SAVE_TO_DRIVE = True
HF_REPO      = ""        # optional, e.g. "you/seishin-agent-gguf" (needs an HF_TOKEN Colab secret)
""")

code("""
%%capture
!pip install -q unsloth   # pulls matching torch / transformers / trl / peft versions
""")

md("## 1 · Dataset (generator + tool schemas from the Seishin repo)")
code("%%writefile tools.json\n" + (HERE / "tools.json").read_text())
code("%%writefile generate_dataset.py\n" + (HERE / "generate_dataset.py").read_text())
code("""
!python3 generate_dataset.py --train $TRAIN_N --eval $EVAL_N --seed 7 --out data
import json
train_rows = [json.loads(l) for l in open("data/train.jsonl")]
eval_rows  = [json.loads(l) for l in open("data/eval.jsonl")]
print(json.dumps(train_rows[0]["messages"][1:], indent=1, ensure_ascii=False)[:1500])
""")

md("## 2 · Model")
code("""
import torch
from unsloth import FastLanguageModel
MAX_LEN = 4096  # the app runs llama.rn with n_ctx 4096
model, tokenizer = FastLanguageModel.from_pretrained(BASE_MODEL, max_seq_length=MAX_LEN, dtype=None, load_in_4bit=False)
model = FastLanguageModel.get_peft_model(
    model, r=32, lora_alpha=32, lora_dropout=0, bias="none",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    use_gradient_checkpointing="unsloth", random_state=7,
)
""")

code("""
from datasets import Dataset

def render(row, upto=None, gen_prompt=False):
    # Render in plain Python (not via datasets.map): Arrow would merge every tool-call's
    # arguments into one struct and fill missing keys with nulls.
    msgs = row["messages"] if upto is None else row["messages"][:upto]
    return tokenizer.apply_chat_template(msgs, tools=row["tools"], tokenize=False, add_generation_prompt=gen_prompt)

def to_dataset(rows):
    texts = [render(r) for r in rows]
    n = [len(tokenizer(t).input_ids) for t in texts[:50]]
    print(f"{len(texts)} examples, ~{sum(n)//len(n)} tokens each (max of sample {max(n)})")
    return Dataset.from_dict({"text": texts})

train_ds, eval_ds = to_dataset(train_rows), to_dataset(eval_rows)
print(train_ds[0]["text"][-1200:])
""")

md("## 3 · Accuracy check (generates with the model and parses `<tool_call>` blocks)")
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
    return v.strip().lower() if isinstance(v, str) else v

def same_args(a, b):
    return isinstance(a, dict) and set(a) == set(b) and all(norm(a[k]) == norm(b[k]) for k in b)

@torch.no_grad()
def evaluate(rows, n=EVAL_SAMPLES, batch=16, show=3):
    FastLanguageModel.for_inference(model)
    tokenizer.padding_side = "left"
    cases = []  # every assistant turn of each conversation, given the history before it
    for r in rows[:n]:
        for i, m in enumerate(r["messages"]):
            if m["role"] == "assistant":
                cases.append((render(r, upto=i, gen_prompt=True), m, r["scenario"]))
    stats = dict(turns=0, name_ok=0, exact=0, no_tool_ok=0, no_tool=0, tool_turns=0)
    misses = []
    for s in range(0, len(cases), batch):
        chunk = cases[s:s + batch]
        enc = tokenizer([c[0] for c in chunk], return_tensors="pt", padding=True).to("cuda")
        gen = model.generate(**enc, max_new_tokens=192, do_sample=False, pad_token_id=tokenizer.pad_token_id)
        for (prompt, want, scen), g in zip(chunk, gen):
            text = tokenizer.decode(g[enc.input_ids.shape[1]:], skip_special_tokens=False)
            text = text.split("<|im_end|>")[0].replace("<|endoftext|>", "")
            got = parse_calls(text)
            exp = [(c["function"]["name"], c["function"]["arguments"]) for c in want.get("tool_calls", [])]
            stats["turns"] += 1
            if not exp:
                stats["no_tool"] += 1; ok = not got; stats["no_tool_ok"] += ok
            else:
                stats["tool_turns"] += 1
                names = [g_[0] for g_ in got] == [e[0] for e in exp]; stats["name_ok"] += names
                ok = names and all(same_args(g_[1], e[1]) for g_, e in zip(got, exp)); stats["exact"] += ok
            if not ok and len(misses) < show:
                misses.append((scen, exp or want["content"], text.strip()[:300]))
    tt, nt = max(stats["tool_turns"], 1), max(stats["no_tool"], 1)
    res = {"tool_name_acc": stats["name_ok"] / tt, "tool_exact_acc": stats["exact"] / tt,
           "no_tool_acc": stats["no_tool_ok"] / nt, "turns": stats["turns"]}
    print({k: round(v, 3) if isinstance(v, float) else v for k, v in res.items()})
    for scen, exp, got in misses:
        print(f"  ✗ [{scen}] expected {exp}\\n    got {got!r}")
    FastLanguageModel.for_training(model)
    tokenizer.padding_side = "right"
    return res

print("Base model, before training:")
base_scores = evaluate(eval_rows, n=60)
""")

md("## 4 · Train until done\nEarly stopping on eval loss within each round; extra rounds on fresh data until the accuracy target is hit.")
code("""
from dataclasses import fields
from trl import SFTTrainer, SFTConfig
from transformers import EarlyStoppingCallback
from unsloth.chat_templates import train_on_responses_only
import subprocess

_cfg_fields = {f.name for f in fields(SFTConfig)}
LEN_ARG = "max_seq_length" if "max_seq_length" in _cfg_fields else "max_length"  # renamed in newer TRL

def make_trainer(train, evals, epochs, lr):
    t = SFTTrainer(
        model=model, processing_class=tokenizer, train_dataset=train, eval_dataset=evals,
        args=SFTConfig(
            dataset_text_field="text", packing=False, **{LEN_ARG: MAX_LEN},
            per_device_train_batch_size=4, gradient_accumulation_steps=4,
            num_train_epochs=epochs, learning_rate=lr, lr_scheduler_type="cosine", warmup_ratio=0.05,
            weight_decay=0.01, optim="adamw_8bit", seed=7,
            fp16=not torch.cuda.is_bf16_supported(), bf16=torch.cuda.is_bf16_supported(),
            logging_steps=10, eval_strategy="steps", eval_steps=40, save_strategy="steps", save_steps=40,
            save_total_limit=2, load_best_model_at_end=True, metric_for_best_model="eval_loss",
            per_device_eval_batch_size=4, output_dir="checkpoints", report_to="none",
        ),
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3, early_stopping_threshold=0.001)],
    )
    # Learn only the assistant turns; system, user and tool results (rendered as user) are masked.
    return train_on_responses_only(t, instruction_part="<|im_start|>user\\n", response_part="<|im_start|>assistant\\n")

history = []
for rnd in range(1, MAX_ROUNDS + 1):
    if rnd > 1:  # fresh, unseen conversations for the next round
        subprocess.run(["python3", "generate_dataset.py", "--train", str(TRAIN_N), "--eval", "50",
                        "--seed", str(100 + rnd), "--out", f"data/r{rnd}"], check=True)
        train_ds = to_dataset([json.loads(l) for l in open(f"data/r{rnd}/train.jsonl")])
    print(f"\\n══ Round {rnd} ══")
    trainer = make_trainer(train_ds, eval_ds, MAX_EPOCHS if rnd == 1 else 1, 2e-4 if rnd == 1 else 5e-5)
    trainer.train()
    scores = evaluate(eval_rows)
    history.append(scores)
    if scores["tool_exact_acc"] >= TARGET_ACC and scores["no_tool_acc"] >= 0.85:
        print(f"Target reached in round {rnd}."); break
else:
    print("Round limit reached — best scores:", history[-1], "(raise MAX_ROUNDS or use the 1.5B model)")
""")

code("""
# Try it yourself
def ask(text, now_row=eval_rows[0]):
    row = {"messages": [now_row["messages"][0], {"role": "user", "content": text}], "tools": now_row["tools"]}
    FastLanguageModel.for_inference(model); tokenizer.padding_side = "left"
    enc = tokenizer([render(row, gen_prompt=True)], return_tensors="pt").to("cuda")
    out = model.generate(**enc, max_new_tokens=192, do_sample=False)
    FastLanguageModel.for_training(model); tokenizer.padding_side = "right"
    return tokenizer.decode(out[0][enc.input_ids.shape[1]:], skip_special_tokens=False).split("<|im_end|>")[0]

print(eval_rows[0]["messages"][0]["content"].splitlines()[1])
for q in ["add dentist tomorrow at 3pm", "remind me to pay rent by friday, keep reminding me",
          "what's on my calendar?", "write down: buy a new charger", "thanks!"]:
    print(f"> {q}\\n{ask(q)}\\n")
""")

md("## 5 · Export GGUF for llama.rn")
code("""
import glob, os, shutil
model.save_pretrained(f"{OUT_NAME}-lora"); tokenizer.save_pretrained(f"{OUT_NAME}-lora")
model.save_pretrained_gguf(f"{OUT_NAME}-gguf", tokenizer, quantization_method=QUANT)
ggufs = sorted(glob.glob(f"{OUT_NAME}-gguf*/**/*.gguf", recursive=True) + glob.glob("*.gguf"), key=os.path.getsize)
src = [g for g in ggufs if QUANT.lower() in g.lower()] or ggufs
GGUF = f"{OUT_NAME}-{QUANT.upper()}.gguf"
shutil.copy(src[-1], GGUF)
print(GGUF, f"{os.path.getsize(GGUF) / 1e6:.0f} MB")
""")

md("### Smoke test through llama.cpp's own tool-call parser (`--jinja`, same path as llama.rn)")
code("""
import subprocess, time, requests
srv = next((p for p in glob.glob("llama.cpp/**/llama-server", recursive=True) if os.access(p, os.X_OK)), None)
if not srv:
    print("llama-server not built by this unsloth version — skipping (the HF-side accuracy check above still applies).")
else:
    proc = subprocess.Popen([srv, "-m", GGUF, "--jinja", "-c", "4096", "--port", "8088", "-ngl", "99"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                if requests.get("http://127.0.0.1:8088/health", timeout=1).ok: break
            except requests.RequestException: pass
            time.sleep(1)
        tools = json.load(open("tools.json"))
        for q in ["add team standup tomorrow at 9am", "what tasks do I have?", "hello!"]:
            r = requests.post("http://127.0.0.1:8088/v1/chat/completions", json={
                "messages": [eval_rows[0]["messages"][0], {"role": "user", "content": q}],
                "tools": tools, "tool_choice": "auto", "temperature": 0.3}).json()
            m = r["choices"][0]["message"]
            print(f"> {q}\\n  tool_calls={[(c['function']['name'], c['function']['arguments']) for c in m.get('tool_calls') or []]}"
                  f"\\n  content={m.get('content')!r}")
    finally:
        proc.terminate()
""")

code("""
if SAVE_TO_DRIVE:
    from google.colab import drive
    drive.mount("/content/drive")
    os.makedirs("/content/drive/MyDrive/seishin", exist_ok=True)
    shutil.copy(GGUF, "/content/drive/MyDrive/seishin/")
    shutil.copytree(f"{OUT_NAME}-lora", f"/content/drive/MyDrive/seishin/{OUT_NAME}-lora", dirs_exist_ok=True)
    print("Saved to Drive: MyDrive/seishin/" + GGUF)
if HF_REPO:
    from google.colab import userdata
    from huggingface_hub import HfApi
    api = HfApi(token=userdata.get("HF_TOKEN"))
    api.create_repo(HF_REPO, exist_ok=True)
    api.upload_file(path_or_fileobj=GGUF, path_in_repo=GGUF, repo_id=HF_REPO)
    print(f"https://huggingface.co/{HF_REPO}/resolve/main/{GGUF}")
from google.colab import files
files.download(GGUF)
""")

md("""
## On the phone
Copy `seishin-agent-Q4_K_M.gguf` to the device → Seishin **Settings → On-device model** → pick the file.
The model's chat template is embedded in the GGUF, so llama.rn's `jinja: true` path renders the
tools and parses `<tool_call>` replies with no app changes.
""")

nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"gpuType": "T4", "provenance": []},
                                   "kernelspec": {"display_name": "Python 3", "name": "python3"},
                                   "language_info": {"name": "python"}},
      "nbformat": 4, "nbformat_minor": 0}
out = HERE / "seishin_agent_colab.ipynb"
out.write_text(json.dumps(nb, indent=1, ensure_ascii=False) + "\n")
print(f"wrote {out}")

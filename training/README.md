# Seishin on-device agent model

Fine-tunes a small, fast model for Seishin's local agent (`src/services/local-agent.ts`):
the same system prompt, the same 15 tools (`LOCAL_TOOL_NAMES`), the same tool-result strings.
Output is a GGUF that llama.rn loads with `jinja: true` — no app changes needed.

## Run it (Google Colab, free T4)

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/rylsherdamz-rgb/Seishin/blob/main/training/seishin_agent_colab.ipynb)

1. Open `seishin_agent_colab.ipynb` in Colab (badge above works once this is on `main` and the repo is
   public; otherwise **File → Upload notebook**). The notebook is self-contained.
2. **Runtime → Change runtime type → T4 GPU**, then **Runtime → Run all**.
3. It trains until done: early stopping per round, then extra rounds on fresh data until exact
   tool-call accuracy ≥ `TARGET_ACC` (0.92) or `MAX_ROUNDS` (3). ~30–60 min on a T4 for 0.5B.
4. `seishin-agent-Q4_K_M.gguf` (~400 MB) downloads and is saved to `MyDrive/seishin/`.
5. Copy it to the phone → Seishin **Settings → On-device model** → pick the file.

| Base model | GGUF Q4_K_M | Notes |
|---|---|---|
| `Qwen2.5-0.5B-Instruct` (default) | ~400 MB | Fastest; fits 4 GB phones easily |
| `Qwen2.5-1.5B-Instruct` | ~1 GB | More accurate, ~3× slower; set `BASE_MODEL` |

Qwen2.5 is used because llama.cpp (and so llama.rn) natively parses its `<tool_call>` format.

## Files

- `tools.json` — tool schemas dumped from the app. `src/__tests__/training-tools.test.ts` fails if
  they drift; refresh with `UPDATE_TRAINING_TOOLS=1 npx jest training-tools`, then retrain.
- `generate_dataset.py` — stdlib-only synthetic data: adds/lists/edits/deletes, relative dates
  ("next Friday", "bukas 3pm"), multi-step (list → act by id), parallel calls, ambiguous matches,
  tool errors, memory, inbox, and no-tool chat. `python3 generate_dataset.py --out data/`
- `make_notebook.py` — rebuilds the notebook (embeds the two files above). Rerun after editing them.

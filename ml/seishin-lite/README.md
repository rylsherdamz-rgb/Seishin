# Seishin Lite

A small trained model that understands everyday questions about your day, in English, Tagalog and Taglish. It ships inside the app (`src/services/lite/model.json`, about 50 KB) and runs in plain TypeScript, so it works offline with no download.

- **What it does:** it classifies a message into an intent: agenda, next_event, free_time, tasks_due, overdue, find_event, greeting, thanks, help or other. The app then builds the answer from your own events and tasks (`src/services/lite/answer.ts`), so it never makes up a schedule.
- **Dates and times** are read by rules (`when.ts`), not by the model.
- **Commands** ("add …", "remind me to …", "ilipat …") and anything below the confidence threshold go to the language model (on-device GGUF or NVIDIA NIM).

## Model
- **Features:** about 1024 hashed features: words, word pairs, letter triples (so typos still work), cue-word groups (*sched/ganap/lakad*, *free/bakante*, *due/ipapasa* …) and the message's first word. See `features.py`, and the matching TypeScript port in `src/services/lite/features.ts`.
- **Network:** 1024 → 32 (ReLU, dropout 0.2) → 10 (softmax). Trained with Adam, weight decay 3e-3, 8 epochs, then quantised to int8.
- **Data:** synthetic examples generated from phrasing templates in `dataset.py`, with typo and casing noise. Templates are split into train and test *by template*, so the test score measures phrasings the model never saw.

## Retrain
```sh
python3 ml/seishin-lite/train.py --verbose   # NumPy only, under a second on a laptop
npx jest lite-                               # parity with Python and the hand-written exam
```
The trainer prints accuracy on unseen phrasings and on `probe.py`, a hand-written exam kept apart from the templates. It also writes parity vectors, which the jest suite checks against the TypeScript port. If you change `features.py`, make the same change in `features.ts`.

## Training data
- **Synthetic** (`dataset.py`): English, Tagalog and Taglish templates, plus questions composed from parts, with typo noise.
- **Real** (`public_data.py`): about 10.6k training questions from SLURP and CLINC150. These include 1,300+ real calendar questions, every add/change/remove command, and 12k off-topic questions, keeping every one that sounds like a schedule question ("what's the weather this week"). Fetch them with `python3 ml/seishin-lite/public_data.py --fetch`. See NOTICE.md for licences.
- Each dataset's own test split is never trained on. It's the "real people" scorecard.

## Routing (what the app does)
1. A message that starts like a command ("add …", "remind me to …", "ilipat …") goes to the language model.
2. Confidence is the probability of the top intent's *family* (schedule, tasks or chat).
3. **With a language model set up (strict):** answer only at confidence ≥ 0.75, and only if the message is about the user. That means "my / I / ako / ko …" or a schedule/task word; "when is X" is exempt, because it answers only when an event matches. Precision first: anything less certain gets a full answer from the model.
4. **With no language model:** answer at confidence ≥ 0.55, with no guard. A reasonable best guess beats "I can't help". Both bars were chosen on validation.

## Results on unseen data
| | Round 1 | Round 2 | Round 3 strict (shipped) | Round 3, no model |
|---|---|---|---|---|
| Final exam: wrong kind of answer | 6.3% | 2.5% | **0%** | 2.0% |
| Final exam: exactly right, of answered | 86% | 95% | 97% | 94% |
| Final exam: answered by Seishin Lite | 75% | 71% | 42% | 82% |
| Real off-topic questions answered by mistake (8,117) | — | ~8.9%* | **0.26%** | 1.3% |

\* Measured on the public dev split.

The public test labels are noisy. "do i have any appointments today" and "what am i doing today" are labelled off-topic, so the real-question precision figures understate the model. The final exam has now been scored three times (round 2, round 3, and round 3 after the find_event exemption). It was never used to choose settings, but write a fresh exam before the next round.

What didn't help:
- 10× or 100× more epochs: train accuracy is capped by regularisation, and unseen accuracy moved under 1 point.
- Bigger hidden layers (48, 64, 96).
- More composed data.
- A 3-seed ensemble.

```sh
python3 ml/seishin-lite/public_data.py --fetch
python3 ml/seishin-lite/train.py --public --final --verbose
```

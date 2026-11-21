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

## Routing
Seishin Lite answers when the probability of the top intent's *family* (schedule, tasks or chat) is at least the threshold (0.55). A question split between agenda and next_event is still a sure schedule question, and either answer serves. With no language model set up, the bar is 0.4 and it takes its best guess.

## Results
Settings were tuned on validation only: held-out templates plus `probe.py`. `final_exam.py` (79 hand-written questions) was written before round-2 tuning and scored once at the end:

| Final exam (unseen) | Round 1 | Round 2 (shipped) |
|---|---|---|
| Answered by Seishin Lite itself | 75% | 71% |
| Exactly right, of those | 86% | 95% |
| Wrong kind of answer | 6.3% | 2.5% |
| Actions/general questions answered by mistake | 3 of 18 | 1 of 18 |

What changed in round 2:
- Questions composed from parts: 500 per intent, training only.
- A hyperparameter search over size, epochs and weight decay with 3 seeds each. The winner is 32 hidden units, 6 epochs, weight decay 3e-3.
- Family confidence for routing.

Tried and rejected:
- More composed data (1,000 or 2,000 per intent): it crowds out natural phrasings and coverage drops.
- A 3-seed ensemble: about the same as the best single model at 3× the size.

Known misses on the final exam: short "help" phrasings ("help pls", "paano ka gumagana"), and "what's 12 times 13" read as an agenda question. Don't tune against the final exam. Add new phrasings to `dataset.py` and write a new exam instead.

```sh
python3 ml/seishin-lite/search.py              # validation search (~40 s)
python3 ml/seishin-lite/train.py --final       # train the shipped settings and score the final exam
```

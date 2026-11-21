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

## Current numbers (seed 1)
- **Unseen template phrasings:** 51% answered by Seishin Lite itself, 90% of those exactly right, 0.4% given an answer from the wrong family (schedule vs tasks vs chat).
- **Hand-written exam (70 questions):** 73% answered itself, 96% of those exactly right; 1 general question answered by mistake (a search that finds no event falls through to the model).
- Everything else goes to the language model. With no model set up, it accepts a lower confidence (0.3) and takes its best guess.

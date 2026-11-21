"""Real questions from public datasets, mapped onto Seishin Lite's intents.

- SLURP (Bastianelli et al., 2020): ~16k distinct voice-assistant requests. Text CC BY 4.0.
  https://github.com/pswietojanski/slurp
- CLINC150 (Larson et al., 2019): 150 intents plus out-of-scope questions. CC BY 3.0.
  https://github.com/clinc/oos-eval

Fetch them with `python3 ml/seishin-lite/public_data.py --fetch`, which clones them into ml/seishin-lite/.data
(gitignored). Each dataset's own test split stays out of training: it is the
"real people" scorecard. Only the trained weights ship in the app; see NOTICE.md.
"""
import json
import os
import random
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, ".data")
REPOS = {"slurp": "https://github.com/pswietojanski/slurp", "clinc": "https://github.com/clinc/oos-eval"}

# Commands: always the language model's job.
ACTION_SLURP = {"calendar_set", "calendar_remove", "alarm_set", "alarm_remove", "lists_createoradd", "lists_remove"}
ACTION_CLINC = {"calendar_update", "todo_list_update", "reminder_update", "schedule_meeting", "shopping_list_update",
                "meeting_schedule_update"}
SCHED_CLINC = {"calendar", "meeting_schedule"}
TASKS_CLINC = {"todo_list", "reminder"}
CHAT_CLINC = {"greeting": "greeting", "thank_you": "thanks", "what_can_i_ask_you": "help"}

_FREE = re.compile(r"\b(free|available|availability|open slot|openings?|gaps?|spare time|any time)\b")
_NEXT = re.compile(r"\b(next|upcoming|coming up|after this)\s*(meeting|event|appointment|class|thing|one|on my|item)?\b")
_NEXT_DAY = re.compile(r"\bnext\s+(week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)\b")
_FIND = re.compile(r"^(?:please |can you |could you )?(?:tell me |remind me )?(when|what time|what date|what day|how long until|how many days (?:until|till|before))\b|\bwhen (?:is|was|are|am|do|does|will)\b")
_LISTY = re.compile(r"\b(schedule|calendar|agenda|plans|going on|events|meetings)\b")


def sched_intent(text: str) -> str:
    """Split a real calendar question into Seishin's finer intents by its wording."""
    t = text.lower()
    if _FREE.search(t):
        return "free_time"
    if _NEXT.search(t) and not _NEXT_DAY.search(t):
        return "next_event"
    if _FIND.search(t) and not _LISTY.search(t):
        return "find_event"
    return "agenda"


def fetch():
    os.makedirs(DATA, exist_ok=True)
    for name, url in REPOS.items():
        dest = os.path.join(DATA, name)
        if not os.path.isdir(os.path.join(dest, ".git")):
            subprocess.run(["git", "clone", "-q", "--depth", "1", url, dest], check=True, env={**os.environ, "GIT_LFS_SKIP_SMUDGE": "1"})
    print("datasets in", DATA)


def _slurp(split_files):
    path = os.path.join(DATA, "slurp", "dataset", "slurp")
    out = []
    for f in split_files:
        for line in open(os.path.join(path, f), encoding="utf-8"):
            r = json.loads(line)
            intent, text = r["intent"], r["sentence"].strip()
            if intent == "calendar_query":
                out.append((text, sched_intent(text)))
            elif intent == "lists_query":
                # Seishin's lists are tasks; shopping/other lists are not (CLINC agrees).
                out.append((text, "tasks_due" if _TODO.search(text.lower()) else "other"))
            elif intent == "general_greet":
                out.append((text, "greeting"))
            elif intent in ACTION_SLURP:
                out.append((text, "other"))
            elif intent.split("_")[0] not in ("calendar", "lists"):
                out.append((text, "other"))
    return out


def _clinc(splits):
    d = json.load(open(os.path.join(DATA, "clinc", "data", "data_full.json"), encoding="utf-8"))
    out = []
    for s in splits:
        for text, intent in d[s]:
            if intent in SCHED_CLINC:
                out.append((text, sched_intent(text)))
            elif intent in TASKS_CLINC:
                out.append((text, "tasks_due"))
            elif intent in CHAT_CLINC:
                out.append((text, CHAT_CLINC[intent]))
            else:  # actions, the other 140 intents, out-of-scope
                out.append((text, "other"))
    return out


def load(split: str, other_cap: int = 6000, seed: int = 3):
    """Rows (text, intent) for "train", "dev" or "test". De-duplicated; "other" is capped so it
    doesn't drown the rest (actions are always kept — they teach what not to answer)."""
    if split == "train":
        rows = _slurp(["train.jsonl", "train_synthetic.jsonl"]) + _clinc(["train", "oos_train"])
    elif split == "dev":
        rows = _slurp(["devel.jsonl"]) + _clinc(["val", "oos_val"])
    else:
        rows = _slurp(["test.jsonl"]) + _clinc(["test", "oos_test"])
    seen, uniq = set(), []
    for t, l in rows:
        k = t.lower()
        if k not in seen:
            seen.add(k)
            uniq.append((t, l))
    rng = random.Random(seed)
    other = [r for r in uniq if r[1] == "other"]
    keep = [r for r in uniq if r[1] != "other"]
    if split == "train" and len(other) > other_cap:
        # Keep every command and every off-topic question that sounds like a schedule one
        # ("what's the weather this week", "when's the next train"): those teach the boundary.
        hard = [r for r in other if _is_action_like(r[0]) or _DATEY.search(r[0].lower())]
        rest = [r for r in other if not (_is_action_like(r[0]) or _DATEY.search(r[0].lower()))]
        rng.shuffle(rest)
        other = hard + rest[: max(0, other_cap - len(hard))]
    out = keep + other
    rng.shuffle(out)
    return out


_TODO = re.compile(r"\b(to ?do|todos?|tasks?|reminders?|things to do|deadlines?|homework|assignments?)\b")
_DATEY = re.compile(r"\b(today|tonight|tomorrow|yesterday|week|weekend|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|"
                    r"morning|afternoon|evening|next|when|time|date|day|schedule|calendar|meeting|event|list)\b")
_ACTIONY = re.compile(r"\b(add|set|create|schedule|book|remind|delete|remove|cancel|move|change|put|make)\b")


def _is_action_like(t: str) -> bool:
    return bool(_ACTIONY.search(t.lower()))


if __name__ == "__main__":
    if "--fetch" in sys.argv:
        fetch()
    import collections
    for s in ("train", "dev", "test"):
        rows = load(s)
        print(s, len(rows), dict(collections.Counter(l for _, l in rows)))

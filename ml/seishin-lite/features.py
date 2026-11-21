"""Feature extraction for Seishin Lite. MUST match src/services/lite/features.ts
byte for byte: parity vectors in model.json are checked by the jest suite."""
import math
import re
import unicodedata

DIM = 1024

_WEEKDAYS = ("monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun "
             "lunes martes miyerkules miyerkoles huwebes biyernes sabado").split()
# "may" is left alone: in Tagalog it means "there is" ("may meeting ba ako").
_MONTHS = ("january february march april june july august september october november december "
           "jan feb mar apr jun jul aug sep sept oct nov dec enero pebrero marso abril hunyo hulyo agosto setyembre oktubre nobyembre disyembre").split()
_DAY = set(_WEEKDAYS)
_MONTH = set(_MONTHS)
_PLACEHOLDERS = {"qtime", "qnum", "qday", "qmonth"}


def normalize(text: str) -> list[str]:
    s = unicodedata.normalize("NFD", text.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("’", "'").replace("'", "")
    s = re.sub(r"\b\d{1,2}:\d{2}\s*(am|pm)?\b", " qtime ", s)
    s = re.sub(r"\b\d{1,2}\s*(am|pm)\b", " qtime ", s)
    s = re.sub(r"\d+", " qnum ", s)
    out = []
    for t in re.split(r"[^a-z0-9]+", s):
        if not t:
            continue
        out.append("qday" if t in _DAY else "qmonth" if t in _MONTH else t)
    return out


# Word-meaning hints the hashed features can't learn from a few hundred templates.
# Keep in sync with CUES in src/services/lite/features.ts.
CUES = {
    "sched": "schedule sched schedules agenda calendar lined lineup plan plans planned ganap lakad lakads pasok klase class classes "
             "meeting meetings events event happening busy rundown brief day meron",
    "free": "free available availability bakante slot slots gap gaps break vacant open pwede fit",
    "due": "due deadline deadlines task tasks todo todos homework assignment assignments tapusin gagawin ipapasa "
           "finish pending left kulang work",
    "late": "overdue late miss missed forgot forget behind past lagpas lumagpas natapos nakalimutan slipped unfinished",
    "next": "next susunod kasunod upcoming coming soon after",
    "when": "when kailan kelan anong time oras date day araw",
    "hello": "hi hello hey yo sup kumusta kamusta musta morning evening afternoon umaga gabi hapon hoy uy oy",
    "thanks": "thanks thank thx ty tnx salamat appreciate noted cool nice ok okay sige ayos goods great awesome",
    "help": "help features tutorial guide use kaya gamitin able commands who sino seishin",
    "act": "add create schedule set remind reminder delete remove move cancel reschedule mark book put block change rename "
           "write make idagdag ilipat burahin gawa gumawa gawan paalala paalalahanan pakilagay lagay sumulat save note",
    "ask": "what whats ano anong ba do does is am are which how",
    "time": "qtime noon lunch alas tonight",
    "date": "today tomorrow tmrw tom ngayon bukas mamaya makalawa week weekend linggo qday qmonth qnum",
}
_CUE = {}
for _g, _words in CUES.items():
    for _w in _words.split():
        _CUE.setdefault(_w, []).append(_g)


def fnv1a(s: str) -> int:
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def feature_keys(tokens: list[str]) -> list[str]:
    keys = []
    for i, t in enumerate(tokens):
        keys.append("w:" + t)
        if i + 1 < len(tokens):
            keys.append("b:" + t + "_" + tokens[i + 1])
        if len(t) >= 3 and t not in _PLACEHOLDERS:
            p = "#" + t + "#"
            keys.extend("c:" + p[j:j + 3] for j in range(len(p) - 2))
    groups = []
    for t in tokens:
        for g in _CUE.get(t, ()):
            keys.append("k:" + g)
            groups.append(g)
    if tokens:
        keys.append("s:" + tokens[0])  # how the question starts ("what", "ano", "am", "remind")
        first = _CUE.get(tokens[0], ())
        keys.extend("f:" + g for g in first)  # a message that *starts* with a verb is usually a command
    return keys


def featurize(text: str) -> dict[int, float]:
    counts: dict[int, float] = {}
    for k in feature_keys(normalize(text)):
        i = fnv1a(k) % DIM
        counts[i] = counts.get(i, 0.0) + 1.0
    vec = {i: math.log1p(c) for i, c in counts.items()}
    norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
    return {i: v / norm for i, v in vec.items()}


# A message that starts like a command is an action for the LLM, never a question for Seishin Lite.
_COMMAND = re.compile(
    r"^(?:(?:hey |ok |pls |please |pakisuyo |seishin,? )?)"
    r"(?:add|create|make|schedule (?:a|an|my|the|\w+ (?:on|at|for))|set|delete|remove|cancel|move|reschedule|"
    r"mark|book|put|block|change|rename|write|save|clear|"
    r"remind me (?:to|na|about|that|on|at|tomorrow|bukas|later|mamaya)|don'?t let me forget|"
    r"idagdag|ilipat|burahin|gawa|gumawa|gawan|paalala\w*|pakilagay|ilagay|i-?add|pa-?remind|sumulat|isulat)\b"
)


def is_command(text: str) -> bool:
    s = unicodedata.normalize("NFD", text.lower().strip())
    s = "".join(c for c in s if not unicodedata.combining(c)).replace("\u2019", "'")
    return bool(_COMMAND.match(s))

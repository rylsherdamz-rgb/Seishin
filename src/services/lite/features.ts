/**
 * Seishin Lite text features. A line-for-line port of ml/seishin-lite/features.py:
 * the model was trained on exactly these features, so any drift silently breaks
 * it — lite-model.test.ts checks the shipped parity vectors.
 */
export const DIM = 1024;

const WEEKDAYS = ("monday tuesday wednesday thursday friday saturday sunday mon tue tues wed thu thur thurs fri sat sun " +
  "lunes martes miyerkules miyerkoles huwebes biyernes sabado").split(" ");
// "may" is left alone: in Tagalog it means "there is" ("may meeting ba ako").
const MONTHS = ("january february march april june july august september october november december " +
  "jan feb mar apr jun jul aug sep sept oct nov dec enero pebrero marso abril hunyo hulyo agosto setyembre oktubre nobyembre disyembre").split(" ");
const DAY = new Set(WEEKDAYS);
const MONTH = new Set(MONTHS);
const PLACEHOLDERS = new Set(["qtime", "qnum", "qday", "qmonth"]);

// Word-meaning hints. Keep in sync with CUES in features.py.
const CUES: Record<string, string> = {
  sched: "schedule sched schedules agenda calendar lined lineup plan plans planned ganap lakad lakads pasok klase class classes " +
    "meeting meetings events event happening busy rundown brief day meron",
  free: "free available availability bakante slot slots gap gaps break vacant open pwede fit",
  due: "due deadline deadlines task tasks todo todos homework assignment assignments tapusin gagawin ipapasa " +
    "finish pending left kulang work",
  late: "overdue late miss missed forgot forget behind past lagpas lumagpas natapos nakalimutan slipped unfinished",
  next: "next susunod kasunod upcoming coming soon after",
  when: "when kailan kelan anong time oras date day araw",
  hello: "hi hello hey yo sup kumusta kamusta musta morning evening afternoon umaga gabi hapon hoy uy oy",
  thanks: "thanks thank thx ty tnx salamat appreciate noted cool nice ok okay sige ayos goods great awesome",
  help: "help features tutorial guide use kaya gamitin able commands who sino seishin",
  act: "add create schedule set remind reminder delete remove move cancel reschedule mark book put block change rename " +
    "write make idagdag ilipat burahin gawa gumawa gawan paalala paalalahanan pakilagay lagay sumulat save note",
  ask: "what whats ano anong ba do does is am are which how",
  time: "qtime noon lunch alas tonight",
  date: "today tomorrow tmrw tom ngayon bukas mamaya makalawa week weekend linggo qday qmonth qnum",
};
const CUE = new Map<string, string[]>();
for (const [g, words] of Object.entries(CUES)) {
  for (const w of words.split(" ")) CUE.set(w, [...(CUE.get(w) ?? []), g]);
}

/** Lowercase, strip accents and apostrophes. */
export function fold(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/’/g, "'");
}

export function normalize(text: string): string[] {
  let s = fold(text).replace(/'/g, "");
  s = s.replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/g, " qtime ");
  s = s.replace(/\b\d{1,2}\s*(am|pm)\b/g, " qtime ");
  s = s.replace(/\d+/g, " qnum ");
  return s.split(/[^a-z0-9]+/).filter(Boolean).map((t) => (DAY.has(t) ? "qday" : MONTH.has(t) ? "qmonth" : t));
}

export function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function featureKeys(tokens: string[]): string[] {
  const keys: string[] = [];
  tokens.forEach((t, i) => {
    keys.push("w:" + t);
    if (i + 1 < tokens.length) keys.push("b:" + t + "_" + tokens[i + 1]);
    if (t.length >= 3 && !PLACEHOLDERS.has(t)) {
      const p = "#" + t + "#";
      for (let j = 0; j < p.length - 2; j++) keys.push("c:" + p.slice(j, j + 3));
    }
  });
  for (const t of tokens) for (const g of CUE.get(t) ?? []) keys.push("k:" + g);
  if (tokens.length) {
    keys.push("s:" + tokens[0]);
    for (const g of CUE.get(tokens[0]) ?? []) keys.push("f:" + g);
  }
  return keys;
}

/** Sparse, L2-normalised log-count vector: index → value. */
export function featurize(text: string): Map<number, number> {
  const counts = new Map<number, number>();
  for (const k of featureKeys(normalize(text))) {
    const i = fnv1a(k) % DIM;
    counts.set(i, (counts.get(i) ?? 0) + 1);
  }
  let norm = 0;
  const vec = new Map<number, number>();
  counts.forEach((c, i) => { const v = Math.log1p(c); vec.set(i, v); norm += v * v; });
  norm = Math.sqrt(norm) || 1;
  vec.forEach((v, i) => vec.set(i, v / norm));
  return vec;
}

// A message that starts like a command is an action for the LLM, never a question for Seishin Lite.
const COMMAND = new RegExp(
  "^(?:(?:hey |ok |pls |please |pakisuyo |seishin,? )?)" +
  "(?:add|create|make|schedule (?:a|an|my|the|\\w+ (?:on|at|for))|set|delete|remove|cancel|move|reschedule|" +
  "mark|book|put|block|change|rename|write|save|clear|" +
  "remind me (?:to|na|about|that|on|at|tomorrow|bukas|later|mamaya)|don'?t let me forget|" +
  "idagdag|ilipat|burahin|gawa|gumawa|gawan|paalala\\w*|pakilagay|ilagay|i-?add|pa-?remind|sumulat|isulat)\\b",
);

export function isCommand(text: string): boolean {
  return COMMAND.test(fold(text.trim()));
}

// Seishin Lite only answers questions about *the user's* day: the message must say "my / I / ako / ko …"
// or use a schedule/task word. "What's the weather this week" and "what's happening in NY" share the
// date words but neither, so they go to the language model. Keep in sync with features.py.
const PERSONAL = new Set("i im ive id me my mine myself we our us ako ko akin aking natin namin kami tayo atin amin".split(" "));
const DOMAIN = new Set(("schedule sched schedules agenda calendar lined lineup plans planned ganap lakad pasok klase class classes " +
  "meeting meetings event events appointment appointments busy free available bakante slot slots " +
  "due deadline deadlines task tasks todo todos homework assignment assignments ipapasa tapusin gagawin " +
  "overdue late missed upcoming susunod next").split(" "));

export function aboutMe(text: string): boolean {
  return normalize(text).some((t) => PERSONAL.has(t) || DOMAIN.has(t));
}

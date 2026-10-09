/**
 * Smart capture: turn OCR text from dumped photos into something actionable.
 *
 * `analyzeHeuristic` is pure and offline (always available, unit-tested).
 * `analyzeCapture` asks the configured AI (cloud NIM, else on-device model)
 * for a structured reading and merges it with the heuristic, so a missing AI,
 * a bad key or malformed model output never loses the due date or questions.
 */
import { completeText } from "./ai-complete";
import { createLogger } from "@/utils/logger";

const log = createLogger("capture");

export type CaptureKind = "assignment" | "exam" | "event" | "reading" | "other";

export interface CaptureAnalysis {
  kind: CaptureKind;
  title: string;
  subject?: string;
  /** ISO datetime of the deadline / event start, if one was found. */
  due?: string;
  /** False when only a day was found (due defaults to 11:59 PM). */
  dueHasTime: boolean;
  /** Questions / parts that need an answer, in order. */
  items: string[];
  summary: string;
  /** 0–1: how sure we are about `kind`; low → ask the user. */
  confidence: number;
  source: "ai" | "heuristic";
}

export const KIND_LABELS: Record<CaptureKind, string> = {
  assignment: "Assignment",
  exam: "Exam / quiz",
  event: "Event",
  reading: "Reading / notes",
  other: "Something else",
};

// — Kind detection ——————————————————————————————————————————————

const KIND_WORDS: Record<Exclude<CaptureKind, "other">, RegExp[]> = {
  assignment: [
    /\bassignments?\b/i, /\bhomework\b/i, /\bseatwork\b/i, /\bworksheet\b/i, /\bactivity\b/i,
    /\bexercises?\b/i, /\bproblem set\b/i, /\bessay\b/i, /\breport\b/i, /\bproject\b/i,
    /\banswer the following\b/i, /\bsubmit\b/i, /\bsubmission\b/i, /\bdeadline\b/i, /\bdue\b/i,
    /\bplate\b/i, /\bmodule\b/i, /\breflection paper\b/i,
  ],
  exam: [/\bexam(ination)?s?\b/i, /\bquiz(zes)?\b/i, /\bmidterms?\b/i, /\bfinals?\b/i, /\blong test\b/i, /\breviewer\b/i, /\bcoverage\b/i],
  event: [/\bmeeting\b/i, /\binvit(ation|ed)\b/i, /\bvenue\b/i, /\brsvp\b/i, /\bceremony\b/i, /\bseminar\b/i, /\bwebinar\b/i, /\bwhen\s*:/i, /\bwhere\s*:/i],
  reading: [/\bchapter\b/i, /\blesson\b/i, /\bintroduction\b/i, /\bdefinition\b/i, /\bsummary\b/i, /\bnotes?\b/i],
};

function detectKind(text: string, itemCount: number): { kind: CaptureKind; confidence: number } {
  const scores = Object.entries(KIND_WORDS).map(([kind, res]) => ({
    kind: kind as CaptureKind,
    score: res.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0),
  }));
  // Several numbered questions strongly suggest work to answer.
  const a = scores.find((s) => s.kind === "assignment");
  if (a && itemCount >= 2) a.score += 2;
  scores.sort((x, y) => y.score - x.score);
  const [best, second] = scores;
  if (!best || best.score === 0) return { kind: "other", confidence: 0.2 };
  const margin = best.score - (second?.score ?? 0);
  return { kind: best.kind, confidence: Math.min(0.95, 0.4 + best.score * 0.1 + margin * 0.1) };
}

// — Questions / parts to answer ————————————————————————————————————

const ITEM_START = /^(?:(?:q(?:uestion)?\s*)?\d{1,2}|[a-h]|[ivx]{1,4})\s*[.):\-]\s+(.{3,})$/i;
const TASK_VERBS = /^(answer|explain|describe|discuss|write|solve|compute|calculate|list|compare|define|identify|create|draw|prove|analy[sz]e|evaluate|summari[sz]e|research|read|give|state|find|show|complete|illustrate)\b/i;

const INSTRUCTION = /\b(the following|directions?|instructions?|deadline|due|submit|submission|on or before|pass(?:ed)? on)\b/i;

export function extractItems(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (line.length < 4) continue;
    const numbered = line.match(ITEM_START);
    // Unnumbered lines that are really instructions/deadlines ("Answer the
    // following… submit by Friday") are headers, not things to answer.
    const instruction = INSTRUCTION.test(line);
    const item = numbered ? numbered[1] : !instruction && (line.endsWith("?") || TASK_VERBS.test(line)) ? line : null;
    if (!item) continue;
    const clean = item.replace(/^[-•*]\s*/, "").slice(0, 220);
    const key = clean.toLowerCase();
    if (clean.length >= 4 && !seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
    if (out.length >= 25) break;
  }
  return out;
}

// — Due date parsing ——————————————————————————————————————————————

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const DUE_KEYWORD = /\b(due|deadline|submit(?:ted)?|submission|turn in|pass(?:ed)? (?:on|by)|on or before|until|not later than|exam (?:on|date)|quiz (?:on|date)|scheduled (?:on|for)|date\s*:)/i;

interface DateHit { index: number; date: Date; hasTime: boolean }

function parseTime(s: string): { h: number; m: number } | null {
  const t = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i) ?? s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (/\bnoon\b/i.test(s)) return { h: 12, m: 0 };
  if (/\bmidnight\b/i.test(s)) return { h: 23, m: 59 };
  if (!t) return null;
  let h = Number(t[1]);
  const m = Number(t[2] ?? 0);
  const mer = t[3]?.toLowerCase().replace(/\./g, "");
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return h <= 23 && m <= 59 ? { h, m } : null;
}

function withYear(month: number, day: number, year: number | undefined, now: Date): Date | null {
  if (day < 1 || day > 31 || month < 0 || month > 11) return null;
  let y = year ?? now.getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(y, month, day);
  if (d.getMonth() !== month) return null; // e.g. Feb 31
  // No year written and it's long past → it means next year (e.g. "Jan 5" seen in December).
  if (year === undefined && now.getTime() - d.getTime() > 45 * 86400000) d.setFullYear(y + 1);
  return d;
}

function findDates(text: string, now: Date): DateHit[] {
  const hits: DateHit[] = [];
  const push = (index: number, date: Date | null, tail: string) => {
    if (!date) return;
    const time = parseTime(tail);
    if (time) date.setHours(time.h, time.m, 0, 0);
    else date.setHours(23, 59, 0, 0);
    hits.push({ index, date, hasTime: !!time });
  };
  const tailAt = (i: number) => text.slice(i, i + 40);
  let m: RegExpExecArray | null;

  const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g;
  while ((m = iso.exec(text))) push(m.index, withYear(+m[2] - 1, +m[3], +m[1], now), tailAt(m.index + m[0].length));

  const mdy = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
  while ((m = mdy.exec(text))) push(m.index, withYear(+m[1] - 1, +m[2], m[3] ? +m[3] : undefined, now), tailAt(m.index + m[0].length));

  const monthDay = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?`, "gi");
  while ((m = monthDay.exec(text))) push(m.index, withYear(MONTHS[m[1].toLowerCase().replace(".", "")], +m[2], m[3] ? +m[3] : undefined, now), tailAt(m.index + m[0].length));

  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}(?:,?\\s*(\\d{4}))?`, "gi");
  while ((m = dayMonth.exec(text))) push(m.index, withYear(MONTHS[m[2].toLowerCase().replace(".", "")], +m[1], m[3] ? +m[3] : undefined, now), tailAt(m.index + m[0].length));

  const rel = /\b(today|tonight|tomorrow|(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday))\b/gi;
  while ((m = rel.exec(text))) {
    const word = m[1].toLowerCase();
    const d = new Date(now);
    if (word === "tomorrow") d.setDate(d.getDate() + 1);
    else if (m[2]) {
      const delta = (WEEKDAYS.indexOf(m[2].toLowerCase()) - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + delta + (word.startsWith("next") && delta < 7 ? 0 : 0));
    }
    push(m.index, d, tailAt(m.index + m[0].length));
    if (word === "tonight" && !hits[hits.length - 1].hasTime) {
      hits[hits.length - 1].date.setHours(20, 0, 0, 0);
      hits[hits.length - 1].hasTime = true;
    }
  }
  return hits;
}

/** The deadline: a date right after a "due/deadline/submit" cue, else the earliest upcoming date. */
export function parseDue(text: string, now = new Date()): { date: Date; hasTime: boolean } | null {
  const hits = findDates(text, now);
  if (hits.length === 0) return null;
  const cue = text.match(DUE_KEYWORD);
  if (cue?.index !== undefined) {
    const after = hits
      .filter((h) => h.index >= cue.index! && h.index - cue.index! < 80)
      .sort((a, b) => a.index - b.index)[0];
    if (after) return { date: after.date, hasTime: after.hasTime };
  }
  const upcoming = hits.filter((h) => h.date.getTime() >= now.getTime() - 86400000).sort((a, b) => a.date.getTime() - b.date.getTime());
  const pick = upcoming[0] ?? hits[0];
  return { date: pick.date, hasTime: pick.hasTime };
}

// — Title / subject ————————————————————————————————————————————————

const SUBJECTS = [
  "Mathematics", "Math", "Algebra", "Geometry", "Calculus", "Statistics", "Science", "Physics", "Chemistry",
  "Biology", "English", "Filipino", "History", "Araling Panlipunan", "Economics", "Literature", "Programming",
  "Computer Science", "Accounting", "Philosophy", "Psychology", "Research", "Values Education", "MAPEH", "TLE",
];

function findSubject(text: string): string | undefined {
  const labeled = text.match(/\b(?:subject|course|class)\s*[:\-]\s*([^\n]{2,40})/i);
  if (labeled) return labeled[1].trim();
  return SUBJECTS.find((s) => new RegExp(`\\b${s}\\b`, "i").test(text));
}

function findTitle(text: string, kind: CaptureKind): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => /[a-z]{3}/i.test(l));
  const cue = lines.find((l) => l.length <= 80 && Object.values(KIND_WORDS).flat().slice(0, 12).some((re) => re.test(l)));
  const base = cue ?? lines.find((l) => l.length >= 4 && l.length <= 70) ?? "";
  return base ? base.replace(/\s+/g, " ").slice(0, 70) : KIND_LABELS[kind];
}

export function analyzeHeuristic(text: string, now = new Date()): CaptureAnalysis {
  const items = extractItems(text);
  const { kind, confidence } = detectKind(text, items.length);
  const due = parseDue(text, now);
  const title = findTitle(text, kind);
  const firstLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 3).join(" ");
  return {
    kind,
    title,
    subject: findSubject(text),
    due: due?.date.toISOString(),
    dueHasTime: due?.hasTime ?? false,
    items,
    summary: (items.length ? `${items.length} item${items.length > 1 ? "s" : ""} to answer. ` : "") + firstLines.slice(0, 160),
    confidence,
    source: "heuristic",
  };
}

// — AI analysis ————————————————————————————————————————————————————

const SYSTEM_PROMPT = `You read OCR text from photos a student or worker dumped into their planner (assignments, worksheets, exam notices, event posters, lecture slides).
Return ONLY a JSON object, no prose, with exactly these keys:
{"kind":"assignment|exam|event|reading|other","title":"short title, max 60 chars","subject":"subject/course or null","due":"YYYY-MM-DDTHH:mm in local time, or null if no date","dueHasTime":true|false,"items":["each question or part that must be answered or done, verbatim but trimmed"],"summary":"one or two sentences: what this is and what must be done"}
Rules: due is the deadline/submission/exam date, not the date the document was printed. If only a day is given, use 23:59 and dueHasTime false. Never invent questions.`;

function isKind(x: unknown): x is CaptureKind {
  return typeof x === "string" && x in KIND_LABELS;
}

/** Parse and validate model output; returns null when unusable. */
export function parseAiAnalysis(raw: string): Partial<CaptureAnalysis> | null {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(json);
  } catch {
    return null;
  }
  const out: Partial<CaptureAnalysis> = {};
  if (isKind(o.kind)) out.kind = o.kind;
  if (typeof o.title === "string" && o.title.trim()) out.title = o.title.trim().slice(0, 70);
  if (typeof o.subject === "string" && o.subject.trim()) out.subject = o.subject.trim().slice(0, 40);
  if (typeof o.due === "string" && !isNaN(Date.parse(o.due))) {
    out.due = new Date(o.due).toISOString();
    out.dueHasTime = o.dueHasTime === true;
  }
  if (Array.isArray(o.items)) {
    out.items = o.items.filter((i): i is string => typeof i === "string" && i.trim().length > 2).map((i) => i.trim().slice(0, 220)).slice(0, 25);
  }
  if (typeof o.summary === "string") out.summary = o.summary.trim().slice(0, 300);
  return out.kind || out.title || out.due ? out : null;
}

export async function analyzeCapture(text: string, now = new Date()): Promise<CaptureAnalysis> {
  const base = analyzeHeuristic(text, now);
  if (!text.trim()) return base;
  try {
    const user = `Today is ${now.toDateString()} ${now.toTimeString().slice(0, 5)}.\n\nOCR text:\n"""\n${text.slice(0, 6000)}\n"""`;
    const raw = await completeText(SYSTEM_PROMPT, user);
    const ai = raw ? parseAiAnalysis(raw) : null;
    if (!ai) return base;
    return {
      ...base,
      ...ai,
      // Keep heuristic findings where the model came back empty.
      due: ai.due ?? base.due,
      dueHasTime: ai.due ? ai.dueHasTime ?? false : base.dueHasTime,
      items: ai.items && ai.items.length ? ai.items : base.items,
      confidence: ai.kind ? Math.max(base.confidence, 0.8) : base.confidence,
      source: "ai",
    };
  } catch (e) {
    log.warn("AI analysis failed; using offline reading", e);
    return base;
  }
}

/**
 * Seishin Lite answers, built from the user's own events and tasks (pure —
 * unit-tested). Every fact in a reply comes from the stores, so nothing is
 * made up; when a question can't be answered from them, this returns null
 * and the language model takes over.
 */
import type { CalendarEvent } from "@/stores/calendar-store";
import type { Todo } from "@/stores/todo-store";
import { dateKey, expandOccurrences, keyToDate } from "@/utils/recurrence";
import { formatTime, type TimeFormat, type WeekStart } from "@/theme/prefs";
import type { Intent } from "./model";
import { fold } from "./features";
import { fmtDay, parseDayRange, parseTime, type DayRange } from "./when";

export interface LiteData {
  events: CalendarEvent[];
  todos: Todo[];
  now: Date;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
}

interface Slot { key: string; event: CalendarEvent; start: Date; end: Date; allDay: boolean }

const MAX_LINES = 10;
const MIN = 60000;
const DAY_START = 7; // free-time search window, local hours
const DAY_END = 22;
const MIN_GAP = 30;

const isEndOfDay = (d: Date) => d.getHours() === 23 && d.getMinutes() === 59;

/** Every occurrence of every event between two days, with its real start/end that day. */
function occurrences(events: CalendarEvent[], from: Date, to: Date): Slot[] {
  const out: Slot[] = [];
  for (const e of events) {
    const s0 = new Date(e.startDate);
    const e0 = new Date(e.endDate);
    if (isNaN(s0.getTime())) continue;
    const dur = Math.max(0, (isNaN(e0.getTime()) ? s0.getTime() : e0.getTime()) - s0.getTime());
    for (const key of expandOccurrences(e, dateKey(from), dateKey(to), 60)) {
      const d = keyToDate(key);
      const start = e.allDay ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate(), s0.getHours(), s0.getMinutes());
      out.push({ key, event: e, start, end: e.allDay ? d : new Date(start.getTime() + dur), allDay: !!e.allDay });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key) || Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
}

function dueTasks(todos: Todo[], from: Date, to: Date): Todo[] {
  const lo = dateKey(from), hi = dateKey(to);
  return todos
    .filter((t) => !t.completed && t.dueDate && dateKey(new Date(t.dueDate)) >= lo && dateKey(new Date(t.dueDate)) <= hi)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
}

function overdueTasks(todos: Todo[], now: Date): Todo[] {
  const today = dateKey(now);
  return todos
    .filter((t) => {
      if (t.completed || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      return isEndOfDay(d) ? dateKey(d) < today : d.getTime() < now.getTime();
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
}

const RELATIVE = /^(today|tomorrow|yesterday|this |next |in )/;
const when = (r: DayRange) => (RELATIVE.test(r.label) ? r.label : `on ${r.label}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function slotLine(s: Slot, fmt: TimeFormat): string {
  if (s.allDay) return `- **All day** · ${s.event.title}`;
  const end = s.end.getTime() > s.start.getTime() ? `–${formatTime(s.end, fmt)}` : "";
  return `- **${formatTime(s.start, fmt)}${end}** · ${s.event.title}`;
}

function taskLine(t: Todo, fmt: TimeFormat, now: Date, withDay: boolean): string {
  const d = new Date(t.dueDate!);
  const day = withDay || dateKey(d) !== dateKey(now) ? `${fmtDay(d)}${isEndOfDay(d) ? "" : " "}` : "";
  const time = isEndOfDay(d) ? "" : formatTime(d, fmt);
  const due = `${day}${time}`.trim();
  const hi = t.priority === "high" ? " · high priority" : "";
  return `- ${t.title}${due ? ` · ${due}` : ""}${hi}`;
}

function limited(lines: string[]): string[] {
  return lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES), `- …and ${lines.length - MAX_LINES} more`] : lines;
}

function agenda(text: string, d: LiteData): string {
  const range = parseDayRange(text, d.now, d.weekStart);
  const slots = occurrences(d.events, range.from, range.to);
  const tasks = dueTasks(d.todos, range.from, range.to);
  const multi = range.from.getTime() !== range.to.getTime();
  const title = multi ? `${cap(range.label)} · ${fmtDay(range.from)} – ${fmtDay(range.to)}` : `${cap(range.label)} · ${fmtDay(range.from)}`;
  const out = [`**${title}**`];
  if (slots.length === 0) {
    out.push(tasks.length ? `Nothing on your calendar ${when(range)}.` : `Nothing on your calendar ${when(range)} — it's free.`);
  } else if (multi) {
    const byDay = new Map<string, Slot[]>();
    slots.forEach((s) => byDay.set(s.key, [...(byDay.get(s.key) ?? []), s]));
    const lines: string[] = [];
    byDay.forEach((list, key) => {
      lines.push(`**${fmtDay(keyToDate(key))}**`);
      list.forEach((s) => lines.push(slotLine(s, d.timeFormat)));
    });
    out.push(...limited(lines));
  } else {
    out.push(`${plural(slots.length, "thing")} on your calendar:`, ...limited(slots.map((s) => slotLine(s, d.timeFormat))));
  }
  if (tasks.length) out.push("", `**Due ${when(range)}**`, ...limited(tasks.map((t) => taskLine(t, d.timeFormat, d.now, multi))));
  const late = overdueTasks(d.todos, d.now).length;
  if (late && range.from.getTime() <= d.now.getTime()) out.push("", `${plural(late, "task")} overdue — ask "what's overdue?"`);
  return out.join("\n");
}

function untilText(ms: number): string {
  const m = Math.round(ms / MIN);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return `in ${h} h${r ? ` ${r} min` : ""}`;
  return `in ${plural(Math.round(h / 24), "day")}`;
}

function nextEvent(d: LiteData): string {
  const slots = occurrences(d.events, d.now, new Date(d.now.getTime() + 30 * 86400000)).filter((s) => !s.allDay);
  const now = d.now.getTime();
  const current = slots.find((s) => s.start.getTime() <= now && s.end.getTime() > now);
  const next = slots.find((s) => s.start.getTime() > now);
  const lines: string[] = [];
  if (current) lines.push(`**Now:** ${current.event.title} until ${formatTime(current.end, d.timeFormat)}`);
  if (next) {
    const sameDay = dateKey(next.start) === dateKey(d.now);
    const at = `${sameDay ? "" : `${fmtDay(next.start)}, `}${formatTime(next.start, d.timeFormat)}`;
    lines.push(`**Next up:** ${next.event.title} — ${at} (${untilText(next.start.getTime() - now)})`);
  } else {
    lines.push(current ? "Nothing else after that in the next 30 days." : "Nothing coming up in the next 30 days.");
  }
  return lines.join("\n");
}

function freeTime(text: string, d: LiteData): string {
  const range = parseDayRange(text, d.now, d.weekStart);
  const day = range.from;
  const time = parseTime(text);
  const slots = occurrences(d.events, day, day).filter((s) => !s.allDay);
  if (time) {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.h, time.m);
    const busy = slots.find((s) => s.start.getTime() <= at.getTime() && s.end.getTime() > at.getTime());
    const label = `${formatTime(at, d.timeFormat)} ${when(range)}`;
    if (busy) return `No — at ${label} you have **${busy.event.title}** (${formatTime(busy.start, d.timeFormat)}–${formatTime(busy.end, d.timeFormat)}).`;
    const after = slots.find((s) => s.start.getTime() > at.getTime());
    const until = after ? ` until ${formatTime(after.start, d.timeFormat)} (${after.event.title})` : " — nothing after that either";
    return `Yes, you're free at ${label}${until}.`;
  }
  // Gaps of 30+ minutes between DAY_START and DAY_END (from now, if it's today).
  let cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate(), DAY_START);
  const endOfWindow = new Date(day.getFullYear(), day.getMonth(), day.getDate(), DAY_END);
  if (dateKey(day) === dateKey(d.now) && d.now > cursor) cursor = new Date(Math.ceil(d.now.getTime() / (15 * MIN)) * 15 * MIN);
  const gaps: [Date, Date][] = [];
  for (const s of slots) {
    if (s.start > cursor && (s.start.getTime() - cursor.getTime()) / MIN >= MIN_GAP && cursor < endOfWindow) gaps.push([cursor, s.start < endOfWindow ? s.start : endOfWindow]);
    if (s.end > cursor) cursor = s.end;
  }
  if (cursor < endOfWindow && (endOfWindow.getTime() - cursor.getTime()) / MIN >= MIN_GAP) gaps.push([cursor, endOfWindow]);
  if (!gaps.length) return `No free stretch of ${MIN_GAP}+ minutes ${when(range)} between ${DAY_START}:00 and ${DAY_END}:00.`;
  if (!slots.length) return `${cap(when(range))} is wide open — no events on your calendar.`;
  return [`**Free ${when(range)}**`, ...gaps.map(([a, b]) => `- ${formatTime(a, d.timeFormat)}–${formatTime(b, d.timeFormat)}`)].join("\n");
}

function tasksDue(text: string, d: LiteData): string {
  const range = parseDayRange(text, d.now, d.weekStart);
  // "what's due" with no day: the coming week, which is what people mean.
  const r = range.explicit ? range : { ...range, to: new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate() + 6), label: "in the next 7 days" };
  const tasks = dueTasks(d.todos, r.from, r.to);
  const late = overdueTasks(d.todos, d.now);
  const out: string[] = [];
  out.push(tasks.length ? `**Due ${when(r)}**` : `Nothing due ${when(r)}.`, ...limited(tasks.map((t) => taskLine(t, d.timeFormat, d.now, r.from.getTime() !== r.to.getTime()))));
  if (late.length) out.push("", `**Overdue**`, ...limited(late.map((t) => taskLine(t, d.timeFormat, d.now, true))));
  const undated = d.todos.filter((t) => !t.completed && !t.dueDate).length;
  if (undated && !range.explicit) out.push("", `Plus ${plural(undated, "task")} with no due date.`);
  return out.join("\n");
}

function overdue(d: LiteData): string {
  const late = overdueTasks(d.todos, d.now);
  if (!late.length) return "Nothing overdue — you're all caught up.";
  return [`**${plural(late.length, "task")} overdue**`, ...limited(late.map((t) => taskLine(t, d.timeFormat, d.now, true)))].join("\n");
}

const STOP = new Set(("when whens what whats is was my the a an of for on at in to do does did i have has time day date " +
  "find search kailan kelan anong ano ang ko yung sa ng ba po next last is are be about with " +
  "today tomorrow tonight week bukas ngayon").split(" "));

const words = (s: string) => fold(s).replace(/'/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/** "When is my dentist appointment?" → the next (or else most recent) matching event or task. */
function findEvent(text: string, d: LiteData): string | null {
  const wanted = words(text).filter((w) => !STOP.has(w));
  if (!wanted.length) return null;
  const score = (title: string) => {
    const tw = words(title);
    return wanted.filter((w) => tw.some((t) => t === w || (w.length >= 4 && (t.startsWith(w) || w.startsWith(t))))).length;
  };
  const day = 86400000;
  const pick = (slots: Slot[]) => slots.map((s) => ({ s, n: score(s.event.title) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0]?.s;
  const upcoming = pick(occurrences(d.events, d.now, new Date(d.now.getTime() + 365 * day)).filter((s) => s.allDay ? dateKey(s.start) >= dateKey(d.now) : s.end > d.now));
  const at = (s: Slot) => `${fmtDay(s.start)}${s.allDay ? " (all day)" : `, ${formatTime(s.start, d.timeFormat)}`}`;
  if (upcoming) return `**${upcoming.event.title}** — ${at(upcoming)} (${untilText(upcoming.start.getTime() - d.now.getTime()).replace(/^in -?\d+ min$/, "now")})`;
  const task = d.todos.filter((t) => !t.completed && t.dueDate).map((t) => ({ t, n: score(t.title) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0]?.t;
  if (task) return `**${task.title}** is due ${taskLine(task, d.timeFormat, d.now, true).split(" · ")[1] ?? "soon"}.`;
  const past = pick(occurrences(d.events, new Date(d.now.getTime() - 365 * day), d.now).reverse());
  if (past) return `**${past.event.title}** was ${at(past)}. Nothing like it is coming up.`;
  return null; // no match: let the language model have a go
}

export const HELP = [
  "I can answer these instantly, offline:",
  "- **What's lined up today / tomorrow / this week?**",
  "- **What's next?**",
  "- **Am I free at 3? When am I free tomorrow?**",
  "- **What's due this week? What's overdue?**",
  "- **When is my dentist appointment?**",
  "",
  "Tagalog works too — *\"ano ganap ko bukas?\"*, *\"free ba ako mamayang 3?\"*",
].join("\n");

const GREET = (now: Date) => {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/** The reply for a classified question, or null to hand it to the language model. */
export function answer(intent: Intent, text: string, d: LiteData): string | null {
  switch (intent) {
    case "agenda": return agenda(text, d);
    case "next_event": return nextEvent(d);
    case "free_time": return freeTime(text, d);
    case "tasks_due": return tasksDue(text, d);
    case "overdue": return overdue(d);
    case "find_event": return findEvent(text, d);
    case "greeting": {
      const today = occurrences(d.events, d.now, d.now).length;
      const due = dueTasks(d.todos, d.now, d.now).length;
      const summary = today || due ? ` You have ${plural(today, "event")} and ${plural(due, "task")} due today — ask "what's lined up today?"` : ` Ask me "what's lined up today?" or "what's due this week?"`;
      return `${GREET(d.now)}!${summary}`;
    }
    case "thanks": return "Anytime!";
    case "help": return HELP;
    default: return null;
  }
}

import type { CalendarEvent, Recurrence } from "@/stores/calendar-store";
import type { NoteAttachment } from "@/stores/notes-store";
import type { Todo } from "@/stores/todo-store";
import { dateKey, keyToDate } from "@/utils/recurrence";

export interface CalendarItem {
  id: string;
  type: "event" | "todo";
  title: string;
  description?: string;
  date: string;
  time?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
  allDay?: boolean;
  source?: string;
  priority?: string;
  completed?: boolean;
  todoId?: string;
  notes?: string;
  eventId?: string;
  recurrence?: Recurrence;
  reminder?: number;
  attachments?: NoteAttachment[];
}

export type DateHeader = { kind: "date-header"; date: string; label: string };
export type AgendaRow = DateHeader | CalendarItem;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

export function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function eventToItem(e: CalendarEvent, date: string): CalendarItem {
  const start = new Date(e.startDate);
  const end = new Date(e.endDate);
  return {
    id: e.id,
    type: "event",
    title: e.title,
    description: e.description,
    date,
    time: isNaN(start.getTime()) ? undefined : formatClock(start),
    endTime: isNaN(end.getTime()) ? undefined : formatClock(end),
    startDate: e.startDate,
    endDate: e.endDate,
    allDay: e.allDay,
    source: e.source,
    notes: e.notes,
    eventId: e.id,
    recurrence: e.recurrence,
    reminder: e.reminder,
    attachments: e.attachments,
  };
}

export function todoToItem(t: Todo, date: string): CalendarItem {
  return {
    id: `todo-${t.id}`,
    type: "todo",
    title: t.title,
    date,
    priority: t.priority,
    completed: t.completed,
    todoId: t.id,
  };
}

/** Minutes since midnight of an ISO datetime, or null. */
export function minutesOf(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

export function sortItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    // All-day events and todos lead the day; then chronological.
    const am = a.type === "event" && !a.allDay ? minutesOf(a.startDate) : -1;
    const bm = b.type === "event" && !b.allDay ? minutesOf(b.startDate) : -1;
    return (am ?? -1) - (bm ?? -1);
  });
}

export function buildSections(items: CalendarItem[]): AgendaRow[] {
  const rows: AgendaRow[] = [];
  let lastDate = "";
  for (const item of items) {
    if (item.date !== lastDate) {
      lastDate = item.date;
      rows.push({ kind: "date-header", date: item.date, label: relativeDayLabel(item.date) });
    }
    rows.push(item);
  }
  return rows;
}

export function addDays(key: string, delta: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

export function shiftMonth(key: string, delta: number): string {
  const d = keyToDate(key);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return dateKey(d);
}

export function startOfWeek(key: string): string {
  const d = keyToDate(key);
  return addDays(key, -d.getDay());
}

export function weekOf(key: string): string[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 6×7 grid of date keys covering the month that contains `key`. */
export function monthMatrix(key: string): string[][] {
  const first = keyToDate(key);
  first.setDate(1);
  const gridStart = startOfWeek(dateKey(first));
  return Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => addDays(gridStart, r * 7 + c)),
  );
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function relativeDayLabel(key: string, today = dateKey(new Date())): string {
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  return keyToDate(key).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// — Repeat options ----------------------------------------------------

export type RepeatMode = "none" | "daily" | "weekdays" | "everyday" | "weekly" | "monthly" | "custom";

export const REPEAT_OPTIONS: { key: RepeatMode; label: string }[] = [
  { key: "none", label: "Never" },
  { key: "daily", label: "Daily" },
  { key: "weekdays", label: "Weekdays" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom" },
];

export function buildRecurrence(mode: RepeatMode, weekdays: number[]): Recurrence | undefined {
  switch (mode) {
    case "daily":
      return { frequency: "daily", interval: 1 };
    case "weekdays":
      return { frequency: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] };
    case "everyday":
      return { frequency: "weekly", interval: 1, weekdays: [0, 1, 2, 3, 4, 5, 6] };
    case "weekly":
      return { frequency: "weekly", interval: 1 };
    case "monthly":
      return { frequency: "monthly", interval: 1 };
    case "custom":
      return weekdays.length > 0 ? { frequency: "weekly", interval: 1, weekdays: [...weekdays].sort() } : undefined;
    default:
      return undefined;
  }
}

export function recurrenceToState(r?: Recurrence): { mode: RepeatMode; weekdays: number[] } {
  if (!r) return { mode: "none", weekdays: [] };
  if (r.frequency === "daily") return { mode: "daily", weekdays: [] };
  if (r.frequency === "monthly") return { mode: "monthly", weekdays: [] };
  const wd = r.weekdays ?? [];
  if (wd.length === 7) return { mode: "daily", weekdays: [] };
  if (wd.length === 5 && [...wd].sort().join(",") === "1,2,3,4,5") return { mode: "weekdays", weekdays: [] };
  if (wd.length > 0) return { mode: "custom", weekdays: [...wd].sort() };
  return { mode: "weekly", weekdays: [] };
}

export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "None" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 1440, label: "1 day" },
];

export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

// — Quick add parsing -------------------------------------------------

export interface QuickParse {
  title: string;
  date: string;
  /** Minutes since midnight, if a time was found. */
  minutes: number | null;
  duration: number | null;
}

const TIME_RE = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:at\s+)?(\d{1,2}):(\d{2})\b/i;
const DUR_RE = /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes)\b/i;
const DAY_RE = /\b(today|tonight|tomorrow|tmr|tmrw|(?:next\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*)\b/i;

/** Parse "Lunch with Sam tomorrow 1pm for 90m" into its parts. */
export function parseQuickAdd(input: string, baseDate: string): QuickParse {
  let text = ` ${input} `;
  let date = baseDate;
  let minutes: number | null = null;
  let duration: number | null = null;

  const dm = text.match(DAY_RE);
  if (dm) {
    date = resolveDayWord(dm[1].toLowerCase(), dm[2]?.toLowerCase());
    if (dm[1].toLowerCase() === "tonight") minutes = 20 * 60;
    text = text.replace(dm[0], " ");
  }
  const tm = text.match(TIME_RE);
  if (tm) {
    minutes = tm[1] !== undefined ? to24(Number(tm[1]), Number(tm[2] ?? 0), tm[3]) : to24(Number(tm[4]), Number(tm[5]), undefined);
    text = text.replace(tm[0], " ");
  }
  const du = text.match(DUR_RE);
  if (du) {
    const n = Number(du[1]);
    duration = Math.round(/^h/i.test(du[2]) ? n * 60 : n);
    text = text.replace(du[0], " ");
  }
  const title = text.replace(/\s+/g, " ").trim();
  return { title, date, minutes, duration: duration && duration > 0 ? duration : null };
}

function to24(h: number, m: number, mer?: string): number | null {
  if (h > 23 || m > 59) return null;
  let hh = h;
  if (mer) {
    const pm = mer.toLowerCase() === "pm";
    if (h === 12) hh = pm ? 12 : 0;
    else hh = pm ? h + 12 : h;
  }
  return hh * 60 + m;
}

function resolveDayWord(word: string, weekday?: string): string {
  const today = dateKey(new Date());
  if (word === "today" || word === "tonight") return today;
  if (word.startsWith("tom") || word.startsWith("tmr")) return addDays(today, 1);
  if (!weekday) return today;
  const target = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(weekday);
  const cur = keyToDate(today).getDay();
  // A bare weekday always means the upcoming one, never today.
  const delta = (target - cur + 7) % 7 || 7;
  return addDays(today, delta);
}

/** Next round half-hour after now (for new-event defaults). */
export function nextSlotMinutes(now = new Date()): number {
  const m = now.getHours() * 60 + now.getMinutes();
  return Math.min(Math.ceil((m + 1) / 30) * 30, 23 * 60 + 30);
}

export function atMinutes(key: string, minutes: number): Date {
  const d = keyToDate(key);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

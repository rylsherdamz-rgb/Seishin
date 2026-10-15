/**
 * What the home-screen widgets show (pure — unit-tested). Rendering lives in
 * the *Widget.tsx files; this only turns events + tasks into rows.
 */
import type { CalendarEvent } from "@/stores/calendar-store";
import type { Todo } from "@/stores/todo-store";
import { dateKey, keyToDate, occursOnDate } from "@/utils/recurrence";

export interface WidgetRow {
  id: string;
  kind: "event" | "task";
  title: string;
  /** "9:30 AM", "All day", "Due 5:00 PM", "Overdue". */
  when: string;
  /** Minutes since midnight for sorting; all-day first. */
  sort: number;
  overdue?: boolean;
  /** "2/5" checklist progress for tasks. */
  progress?: string;
  todoId?: string;
  day: string;
}

export interface AgendaDay {
  day: string;
  label: string;
  rows: WidgetRow[];
}

export interface MonthCell {
  key: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  /** Events + due tasks that day (dots). */
  count: number;
}

export interface NextUp {
  title: string;
  when: string;
  kind: "event" | "task";
  todoId?: string;
  day: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function fmtTime(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function dayLabel(key: string, today: string): string {
  if (key === today) return "Today";
  if (key === dateKey(addDays(keyToDate(today), 1))) return "Tomorrow";
  const d = keyToDate(key);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function headerDate(now: Date): { weekday: string; date: string; month: string } {
  return { weekday: DAYS_LONG[now.getDay()], date: String(now.getDate()), month: `${MONTHS_LONG[now.getMonth()]} ${now.getFullYear()}` };
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();
const openTask = (t: Todo) => !t.completed;
const dueOf = (t: Todo) => (t.dueDate ? new Date(t.dueDate) : null);
const progressOf = (t: Todo) => (t.items?.length ? `${t.items.filter((i) => i.done).length}/${t.items.length}` : undefined);
/** "Due 23:59" is the all-day convention for deadlines without a time. */
const isEndOfDay = (d: Date) => d.getHours() === 23 && d.getMinutes() === 59;

function eventRow(e: CalendarEvent, day: string): WidgetRow {
  const start = new Date(e.startDate);
  return {
    id: `${e.id}:${day}`,
    kind: "event",
    title: e.title,
    when: e.allDay ? "All day" : fmtTime(start),
    sort: e.allDay ? -1 : minutes(start),
    day,
  };
}

function taskRow(t: Todo, day: string, now: Date): WidgetRow {
  const due = dueOf(t)!;
  const overdue = due.getTime() < now.getTime();
  return {
    id: `task-${t.id}`,
    kind: "task",
    title: t.title,
    when: overdue ? "Overdue" : isEndOfDay(due) ? (day === dateKey(now) ? "Due today" : "Due end of day") : `Due ${fmtTime(due)}`,
    sort: overdue ? -2 : isEndOfDay(due) ? 24 * 60 : minutes(due),
    overdue,
    progress: progressOf(t),
    todoId: t.id,
    day,
  };
}

/** Today (incl. overdue tasks and what's still ahead) and the next days. */
export function agendaFor(events: CalendarEvent[], todos: Todo[], now: Date, days = 2): AgendaDay[] {
  const today = dateKey(now);
  const out: AgendaDay[] = [];
  for (let i = 0; i < days; i++) {
    const key = dateKey(addDays(now, i));
    const rows: WidgetRow[] = [];
    for (const e of events) {
      if (!occursOnDate(e, key)) continue;
      if (key === today && !e.allDay && !e.recurrence) {
        const end = new Date(e.endDate);
        if (!isNaN(end.getTime()) && end.getTime() < now.getTime()) continue; // already over
      }
      rows.push(eventRow(e, key));
    }
    for (const t of todos) {
      const due = dueOf(t);
      if (!openTask(t) || !due || isNaN(due.getTime())) continue;
      const dueKey = dateKey(due);
      if (dueKey === key || (key === today && dueKey < today)) {
        const row = taskRow(t, key, now);
        if (dueKey !== key) row.when = `Overdue · ${dayLabel(dueKey, today)}`;
        rows.push(row);
      }
    }
    rows.sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title));
    out.push({ day: key, label: dayLabel(key, today), rows });
  }
  return out;
}

/** Open tasks: overdue, then by deadline, then undated. */
export function tasksFor(todos: Todo[], now: Date, limit = 30): WidgetRow[] {
  const today = dateKey(now);
  const open = todos.filter(openTask);
  const ts = (t: Todo) => dueOf(t)?.getTime() ?? Number.POSITIVE_INFINITY;
  open.sort((a, b) => ts(a) - ts(b) || a.createdAt.localeCompare(b.createdAt));
  return open.slice(0, limit).map((t) => {
    const due = dueOf(t);
    const valid = !!due && !isNaN(due.getTime());
    const key = valid ? dateKey(due!) : today;
    const overdue = valid && due!.getTime() < now.getTime();
    let when = "";
    if (valid) {
      const label = dayLabel(key, today);
      when = overdue ? `Overdue · ${label}` : isEndOfDay(due!) ? label : `${label} · ${fmtTime(due!)}`;
    }
    return { id: `task-${t.id}`, kind: "task", title: t.title, when, sort: 0, overdue, progress: progressOf(t), todoId: t.id, day: key };
  });
}

/** 6×7 grid (Sunday first) for `year`/`month` (0-based). */
export function monthGrid(year: number, month: number, events: CalendarEvent[], todos: Todo[], now: Date): MonthCell[][] {
  const first = new Date(year, month, 1);
  const start = addDays(first, -first.getDay());
  const today = dateKey(now);
  const lo = dateKey(start);
  const hi = dateKey(addDays(start, 41));
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (let i = 0; i < 42; i++) {
    const k = dateKey(addDays(start, i));
    for (const e of events) if (occursOnDate(e, k)) bump(k);
  }
  for (const t of todos) {
    const due = dueOf(t);
    if (!openTask(t) || !due || isNaN(due.getTime())) continue;
    const k = dateKey(due);
    if (k >= lo && k <= hi) bump(k);
  }
  const weeks: MonthCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: MonthCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const key = dateKey(date);
      row.push({ key, day: date.getDate(), inMonth: date.getMonth() === month, today: key === today, count: counts.get(key) ?? 0 });
    }
    weeks.push(row);
  }
  // Drop a trailing week that is entirely next month.
  return weeks[5].every((c) => !c.inMonth) ? weeks.slice(0, 5) : weeks;
}

function relative(target: Date, now: Date): string {
  const mins = Math.round((target.getTime() - now.getTime()) / 60000);
  if (mins <= 0) return "Now";
  if (mins < 60) return `in ${mins} min`;
  const today = dateKey(now);
  const key = dateKey(target);
  if (key === today) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `in ${h} h ${m} min` : `in ${h} h`;
  }
  return `${dayLabel(key, today)} · ${fmtTime(target)}`;
}

/** The single next thing: an ongoing/upcoming event or the nearest open deadline (7 days). */
export function nextUp(events: CalendarEvent[], todos: Todo[], now: Date): NextUp | null {
  let best: { at: number; item: NextUp } | null = null;
  const consider = (at: number, item: NextUp) => {
    if (!best || at < best.at) best = { at, item };
  };
  for (let i = 0; i < 7; i++) {
    const key = dateKey(addDays(now, i));
    for (const e of events) {
      if (e.allDay || !occursOnDate(e, key)) continue;
      const s = new Date(e.startDate);
      const start = keyToDate(key);
      start.setHours(s.getHours(), s.getMinutes(), 0, 0);
      const end = new Date(e.endDate);
      const dur = !isNaN(end.getTime()) && end > s ? end.getTime() - s.getTime() : 0;
      if (start.getTime() + dur < now.getTime()) continue;
      const ongoing = start.getTime() <= now.getTime();
      consider(ongoing ? now.getTime() : start.getTime(), {
        title: e.title,
        when: ongoing ? `Now · until ${fmtTime(new Date(start.getTime() + dur))}` : relative(start, now),
        kind: "event",
        day: key,
      });
    }
    if (best) break; // nearest day with an event wins over later days
  }
  for (const t of todos) {
    const due = dueOf(t);
    if (!openTask(t) || !due || isNaN(due.getTime())) continue;
    if (due.getTime() - now.getTime() > 7 * 86400000) continue;
    const overdue = due.getTime() < now.getTime();
    const today = dateKey(now);
    const label = dayLabel(dateKey(due), today);
    const when = overdue ? "Overdue" : isEndOfDay(due) ? `Due ${label === "Today" || label === "Tomorrow" ? label.toLowerCase() : label}` : `Due ${relative(due, now)}`;
    consider(overdue ? now.getTime() - 1 : due.getTime(), { title: t.title, when, kind: "task", todoId: t.id, day: dateKey(due) });
  }
  return best ? (best as { item: NextUp }).item : null;
}

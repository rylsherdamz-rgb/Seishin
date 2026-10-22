/**
 * Tasks screen rows (pure — unit-tested): open tasks split into Overdue, Today,
 * Upcoming and No date, then Completed. Labels are computed here once per
 * change, so list rows never format dates while rendering.
 */
import type { Todo } from "@/stores/todo-store";
import { dateKey } from "./recurrence";
import { dayLabel, fmtTime } from "@/widgets/widget-data";
import type { TimeFormat } from "@/theme/prefs";

export type TaskSection = "overdue" | "today" | "upcoming" | "nodate" | "completed";

export type TaskListRow =
  | { kind: "header"; id: string; section: TaskSection; label: string; count: number }
  | { kind: "task"; id: string; todo: Todo; due?: string; overdue: boolean; progress?: string };

const LABELS: Record<TaskSection, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  nodate: "No date",
  completed: "Completed",
};

/** Deadlines saved without a time use 23:59 ("due that day"). */
const isEndOfDay = (d: Date) => d.getHours() === 23 && d.getMinutes() === 59;
const progressOf = (t: Todo) => (t.items?.length ? `${t.items.filter((i) => i.done).length}/${t.items.length}` : undefined);
const time = (t: Todo) => (t.dueDate ? new Date(t.dueDate).getTime() : NaN);

export function groupTasks(todos: Todo[], now: Date, opts: { showCompleted: boolean; timeFormat: TimeFormat }): TaskListRow[] {
  const today = dateKey(now);
  const buckets: Record<TaskSection, TaskListRow[]> = { overdue: [], today: [], upcoming: [], nodate: [], completed: [] };

  const open = todos.filter((t) => !t.completed).sort((a, b) => (time(a) || Infinity) - (time(b) || Infinity) || b.createdAt.localeCompare(a.createdAt));
  for (const t of open) {
    const d = t.dueDate ? new Date(t.dueDate) : null;
    if (!d || isNaN(d.getTime())) {
      buckets.nodate.push({ kind: "task", id: t.id, todo: t, overdue: false, progress: progressOf(t) });
      continue;
    }
    const key = dateKey(d);
    const at = isEndOfDay(d) ? "" : fmtTime(d, opts.timeFormat);
    const overdue = key < today || (key === today && !!at && d.getTime() < now.getTime());
    const section: TaskSection = overdue ? "overdue" : key === today ? "today" : "upcoming";
    const day = section === "today" ? "" : dayLabel(key, today);
    const due = [day, at].filter(Boolean).join(" · ") || "Due today";
    buckets[section].push({ kind: "task", id: t.id, todo: t, due, overdue, progress: progressOf(t) });
  }

  const done = todos.filter((t) => t.completed).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  if (opts.showCompleted) {
    for (const t of done) buckets.completed.push({ kind: "task", id: t.id, todo: t, overdue: false, progress: progressOf(t) });
  }

  const rows: TaskListRow[] = [];
  for (const section of ["overdue", "today", "upcoming", "nodate", "completed"] as TaskSection[]) {
    const count = section === "completed" ? done.length : buckets[section].length;
    if (count === 0) continue;
    rows.push({ kind: "header", id: `h-${section}`, section, label: LABELS[section], count });
    rows.push(...buckets[section]);
  }
  return rows;
}

export type QuickDue = "today" | "tomorrow" | "nextweek";

/** Quick-add date chips: the chosen day at 23:59 ("due that day", no time). */
export function quickDue(kind: QuickDue, now: Date): Date {
  const days = kind === "today" ? 0 : kind === "tomorrow" ? 1 : 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59);
}

/** Which chip a due date matches, if any (a picked date may land on one). */
export function quickDueOf(due: Date | null, now: Date): QuickDue | null {
  if (!due) return null;
  const key = dateKey(due);
  return (["today", "tomorrow", "nextweek"] as QuickDue[]).find((k) => dateKey(quickDue(k, now)) === key) ?? null;
}

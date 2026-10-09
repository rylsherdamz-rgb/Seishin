/**
 * Pure reminder planning (no native modules — unit-tested).
 *
 * "persistent" keeps nudging until the task is done: twice a day while open,
 * every few hours on the due day, a countdown before the deadline, and daily
 * overdue nudges afterwards. Quiet hours (22:00–07:00) are respected except
 * for the final countdown. The app tops the schedule up on every launch, so
 * it never runs out (see task-reminders.ts).
 */
export type ReminderLevel = "persistent" | "normal" | "off";

export interface PlannedReminder {
  at: Date;
  title: string;
}

const H = 3600000;
const D = 24 * H;
const MAX = 40;

function atHour(base: Date, h: number, m = 0): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

const quiet = (d: Date) => d.getHours() >= 22 || d.getHours() < 7;

export function dueLabel(due: Date, at: Date): string {
  const diff = due.getTime() - at.getTime();
  const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff <= 5 * 60000 && diff >= -5 * 60000) return "Due now";
  if (diff < 0) {
    const days = Math.max(1, Math.round(-diff / D));
    return -diff < D ? "Overdue" : `Overdue by ${days} day${days > 1 ? "s" : ""}`;
  }
  if (diff < H) return `Due in ${Math.round(diff / 60000)} min`;
  const sameDay = due.toDateString() === at.toDateString();
  if (sameDay) return `Due today at ${time}`;
  const tomorrow = new Date(at);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due.toDateString() === tomorrow.toDateString()) return `Due tomorrow at ${time}`;
  const days = Math.ceil((atHour(due, 0).getTime() - atHour(at, 0).getTime()) / D);
  return `Due in ${days} days`;
}

export function planReminders(due: Date | null, now: Date, level: ReminderLevel, horizonDays = 14): PlannedReminder[] {
  if (level === "off") return [];
  const out: Date[] = [];
  const add = (d: Date, allowQuiet = false) => {
    if (d.getTime() > now.getTime() + 60000 && (allowQuiet || !quiet(d))) out.push(d);
  };

  if (!due) {
    // No deadline: a daily nudge (persistent) or a single one tomorrow (normal).
    const days = level === "persistent" ? horizonDays : 1;
    for (let i = 0; i <= days; i++) add(atHour(new Date(now.getTime() + i * D), 9));
    return finalize(out, null);
  }

  const dueMs = due.getTime();
  // Countdown. The last ones may ring in quiet hours (a midnight deadline);
  // earlier ones that would land there move to 21:00 rather than vanish.
  for (const before of [24 * H, 6 * H, 2 * H, 30 * 60000]) {
    let d = new Date(dueMs - before);
    if (before > 2 * H && quiet(d)) {
      d = atHour(d, 21);
      if (d.getTime() > dueMs - before) d = new Date(d.getTime() - D); // 00:00–07:00 → previous evening
    }
    add(d, before <= 2 * H);
  }
  add(new Date(dueMs), true);

  if (level === "persistent") {
    const end = Math.min(dueMs, now.getTime() + horizonDays * D);
    // Morning + evening every day until the due day.
    for (let t = atHour(now, 0).getTime(); t <= end; t += D) {
      add(atHour(new Date(t), 9));
      add(atHour(new Date(t), 19));
    }
    // Due day: every 3 hours from 8:00 until the deadline.
    for (let h = 8; h < 22; h += 3) {
      const d = atHour(due, h);
      if (d.getTime() < dueMs) add(d);
    }
    // Overdue: every morning for a week (topped up on launch while still open).
    for (let i = 1; i <= 7; i++) add(atHour(new Date(dueMs + i * D), 9));
  }
  return finalize(out, due);
}

function finalize(dates: Date[], due: Date | null): PlannedReminder[] {
  const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
  const kept: Date[] = [];
  for (const d of sorted) {
    // Drop near-duplicates (within 20 min) — keep the earlier one. Narrow
    // enough that the 30-min warning and the deadline itself both survive.
    if (kept.length && d.getTime() - kept[kept.length - 1].getTime() < 20 * 60000) continue;
    kept.push(d);
  }
  return kept.slice(0, MAX).map((at) => ({ at, title: due ? dueLabel(due, at) : "Still to do" }));
}

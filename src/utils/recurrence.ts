import type { CalendarEvent, Recurrence } from "@/stores/calendar-store";

const MS_DAY = 86400000;

/** Local YYYY-MM-DD key for a date. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function keyToDate(key: string): Date {
  return new Date(key + "T00:00:00");
}

export function eventStartDate(e: CalendarEvent): string {
  return e.startDate.split("T")[0];
}

/** True if the event occurs on the given local YYYY-MM-DD date (non-recurring events: its own start date). */
export function occursOnDate(e: CalendarEvent, date: string): boolean {
  const start = eventStartDate(e);
  if (!e.recurrence) return start === date;
  const rec = e.recurrence;
  if (date < start) return false;
  if (rec.until && date > rec.until) return false;

  const startD = keyToDate(start);
  const target = keyToDate(date);
  const daysDiff = Math.round((target.getTime() - startD.getTime()) / MS_DAY);

  switch (rec.frequency) {
    case "daily":
      return daysDiff % (rec.interval || 1) === 0;
    case "weekly":
      if (rec.weekdays && rec.weekdays.length > 0) {
        return rec.weekdays.includes(target.getDay());
      }
      return daysDiff % (7 * (rec.interval || 1)) === 0;
    case "monthly": {
      if (target.getDate() !== startD.getDate()) return false;
      const monthDiff =
        (target.getFullYear() - startD.getFullYear()) * 12 +
        (target.getMonth() - startD.getMonth());
      return monthDiff >= 0 && monthDiff % (rec.interval || 1) === 0;
    }
    default:
      return false;
  }
}

/** Occurrence date keys for the event within [from, to] (inclusive), bounded by a safety cap. */
export function expandOccurrences(
  e: CalendarEvent,
  from: string,
  to: string,
  maxCount = 400,
): string[] {
  const start = eventStartDate(e);
  const out: string[] = [];
  if (!e.recurrence) {
    if (start >= from && start <= to) out.push(start);
    return out;
  }
  const lo = keyToDate(from > start ? from : start);
  const hi = keyToDate(to);
  const until = e.recurrence.until ? keyToDate(e.recurrence.until) : null;
  let cursor = lo.getTime();
  let guard = 0;
  while (guard < 1500) {
    guard++;
    if (out.length >= maxCount) break;
    if (cursor > hi.getTime()) break;
    if (until && cursor > until.getTime()) break;
    const key = dateKey(new Date(cursor));
    if (occursOnDate(e, key)) out.push(key);
    cursor += MS_DAY;
  }
  return out;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function recurrenceLabel(rec: Recurrence): string {
  if (rec.frequency === "daily") {
    return rec.interval && rec.interval > 1 ? `Every ${rec.interval} days` : "Every day";
  }
  if (rec.frequency === "monthly") {
    return rec.interval && rec.interval > 1 ? `Every ${rec.interval} months` : "Every month";
  }
  const wd = rec.weekdays;
  if (wd && wd.length > 0) {
    if (wd.length === 7) return "Every day";
    if (wd.length === 5 && wd.every((d) => d >= 1 && d <= 5)) return "Weekdays (Mon–Fri)";
    return "Every " + wd.map((d) => DAY_NAMES[d]).join(", ");
  }
  return rec.interval && rec.interval > 1 ? `Every ${rec.interval} weeks` : "Every week";
}

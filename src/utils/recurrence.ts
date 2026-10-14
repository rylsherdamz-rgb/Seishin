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

/**
 * Local calendar day the event starts on. Dates are stored as UTC ISO
 * strings, so the "T" prefix is the UTC day — wrong east/west of UTC (in
 * UTC+8 everything before 08:00, and every all-day event, landed a day early).
 */
export function eventStartDate(e: CalendarEvent): string {
  const d = new Date(e.startDate);
  return isNaN(d.getTime()) ? e.startDate.slice(0, 10) : dateKey(d);
}

/**
 * Last local day a non-recurring all-day event covers (multi-day trips,
 * exams weeks, holidays imported from Google). Other events: the start day.
 */
export function eventLastDate(e: CalendarEvent): string {
  const start = eventStartDate(e);
  if (!e.allDay || e.recurrence) return start;
  const end = new Date(e.endDate);
  if (isNaN(end.getTime())) return start;
  const last = dateKey(new Date(end.getTime() - 1));
  return last > start ? last : start;
}

/** True if the event occurs on the given local YYYY-MM-DD date (non-recurring events: the day(s) it covers). */
export function occursOnDate(e: CalendarEvent, date: string): boolean {
  const start = eventStartDate(e);
  if (!e.recurrence) return date >= start && date <= eventLastDate(e);
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
    const last = eventLastDate(e);
    if (last === start) {
      if (start >= from && start <= to) out.push(start);
      return out;
    }
    for (let d = keyToDate(start > from ? start : from); out.length < maxCount; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const key = dateKey(d);
      if (key > last || key > to) break;
      out.push(key);
    }
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

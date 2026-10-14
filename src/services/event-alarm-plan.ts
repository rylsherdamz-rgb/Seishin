/**
 * Which event alarms should be scheduled right now (pure — unit-tested).
 *
 * The scheduler keeps a rolling window: every upcoming occurrence of every
 * event with a reminder, soonest first, capped so the OS alarm limit (500 per
 * app on Android, shared with task reminders) is never hit. It is re-run on
 * launch, after every sync and in the background, so events that arrive from
 * Google Calendar while the app is closed still ring.
 */
import type { CalendarEvent } from "@/stores/calendar-store";
import { dateKey, expandOccurrences, keyToDate } from "@/utils/recurrence";

export interface AlarmSlot {
  /** `${eventId}:${occurrence ISO}` — stable per occurrence. */
  key: string;
  eventId: string;
  title: string;
  occurrence: Date;
  end?: Date;
  notes: string;
  fireAt: Date;
  /** Imported events get a normal heads-up reminder; your own events ring as an alarm. */
  kind: "alarm" | "reminder";
  /** Changes when anything shown or the fire time changes → reschedule. */
  sig: string;
}

export interface AlarmPlanOptions {
  horizonDays?: number;
  max?: number;
}

/** All-day reminders ring at this hour on the day (minus whole days of lead time). */
export const ALL_DAY_HOUR = 8;
const DAY = 86400000;

function fireTime(e: CalendarEvent, occurrence: Date): Date {
  const lead = e.reminder ?? 0;
  if (e.allDay) {
    const days = Math.floor(lead / 1440);
    return new Date(occurrence.getFullYear(), occurrence.getMonth(), occurrence.getDate() - days, ALL_DAY_HOUR);
  }
  return new Date(occurrence.getTime() - lead * 60000);
}

/** Occurrence start times for an event between `from` and `to` (local days). */
function occurrences(e: CalendarEvent, from: Date, to: Date): Date[] {
  const start = new Date(e.startDate);
  if (isNaN(start.getTime())) return [];
  if (!e.recurrence) return [start];
  return expandOccurrences(e, dateKey(from), dateKey(to), 200).map((k) => {
    const d = keyToDate(k);
    d.setHours(start.getHours(), start.getMinutes(), 0, 0);
    return d;
  });
}

export function slotFor(e: CalendarEvent, occurrence: Date, fireAt: Date): AlarmSlot {
  const start = new Date(e.startDate);
  const end = new Date(e.endDate);
  const dur = !isNaN(end.getTime()) && end > start ? end.getTime() - start.getTime() : 0;
  const notes = e.notes || e.description || "";
  const occEnd = dur ? new Date(occurrence.getTime() + dur) : undefined;
  return {
    key: `${e.id}:${occurrence.toISOString()}`,
    eventId: e.id,
    title: e.title,
    occurrence,
    end: occEnd,
    notes,
    fireAt,
    kind: e.source === "calendar" || e.source === "feed" ? "reminder" : "alarm",
    sig: [e.title, fireAt.getTime(), occEnd?.getTime() ?? 0, notes.length, e.allDay ? 1 : 0].join("|"),
  };
}

export function planEventAlarms(events: CalendarEvent[], now: Date, opts: AlarmPlanOptions = {}): AlarmSlot[] {
  const horizonDays = opts.horizonDays ?? 14;
  const max = opts.max ?? 120;
  const until = now.getTime() + horizonDays * DAY;
  // Look back a day so a reminder with a long lead time for tomorrow's first occurrence isn't missed.
  const from = new Date(now.getTime() - DAY);
  const to = new Date(until + 2 * DAY);
  const out: AlarmSlot[] = [];
  for (const e of events) {
    if (!e.reminder || e.reminder < 0) continue;
    for (const occ of occurrences(e, from, to)) {
      const fireAt = fireTime(e, occ);
      if (fireAt.getTime() <= now.getTime() || fireAt.getTime() > until) continue;
      out.push(slotFor(e, occ, fireAt));
    }
  }
  out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return out.slice(0, max);
}

/**
 * When you add or edit an event whose reminder moment just passed (e.g. a
 * 15-min reminder for something starting in 5 min), ring shortly instead of
 * dropping it. Only for a one-off event added/edited right now — never during
 * the background refresh, or it would re-ring on every launch.
 */
export function catchUpSlot(e: CalendarEvent, now: Date, graceMs = 6 * 3600000): AlarmSlot | null {
  if (!e.reminder || e.recurrence) return null;
  const occ = new Date(e.startDate);
  if (isNaN(occ.getTime())) return null;
  const fireAt = fireTime(e, occ);
  if (fireAt.getTime() > now.getTime()) return null;
  if (now.getTime() - occ.getTime() > graceMs) return null;
  const slot = slotFor(e, occ, new Date(now.getTime() + 10000));
  return { ...slot, sig: `${LATE}${slot.fireAt.getTime()}` };
}

const LATE = "late:";

/** A catch-up ring that hasn't fired yet — the rolling refresh must leave it alone. */
export function isPendingLate(sig: string, now: Date): boolean {
  return sig.startsWith(LATE) && Number(sig.slice(LATE.length)) > now.getTime() - 60000;
}

/** Old map values are a bare notification id; new ones are `id|sig`. */
export function parseRecord(v: string): { id: string; sig: string } {
  const i = v.indexOf("|");
  return i < 0 ? { id: v, sig: "" } : { id: v.slice(0, i), sig: v.slice(i + 1) };
}

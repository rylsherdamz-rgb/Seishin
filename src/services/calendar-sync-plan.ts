/**
 * Pure two-way calendar sync planning (no native modules — unit-tested).
 *
 * Import: device-calendar event instances (Google / Outlook / Samsung
 * accounts on the phone) become read-only Seishin events with source
 * "calendar". Export: Seishin's own events (and optionally task deadlines)
 * are written to one chosen device calendar, so they reach Google Calendar
 * through the phone's normal account sync. Imported events are never
 * exported back, so the two directions can't feed each other.
 */
import type { CalendarEvent, Recurrence } from "@/stores/calendar-store";
import type { Todo } from "@/stores/todo-store";

export interface RemoteEvent {
  id: string;
  calendarId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  notes?: string;
  location?: string | null;
  /** Minutes before start of the event's own first reminder on the phone (null = none set). */
  alarmMinutes?: number | null;
}

export interface ImportOptions {
  /** Reminder for imported events without their own (minutes; 0 = none). */
  defaultReminder?: number;
  /**
   * Android's calendar provider stores all-day events at UTC midnight. Shown
   * as-is they start at 08:00 (UTC+8) or on the previous day (UTC−5), so they
   * are moved to the local day.
   */
  utcAllDay?: boolean;
}

export interface ExportRecord {
  deviceId: string;
  hash: string;
}

export interface ImportPlan {
  upserts: CalendarEvent[];
  removeIds: string[];
}

export interface ExportPlan {
  create: CalendarEvent[];
  update: { event: CalendarEvent; deviceId: string }[];
  remove: { localId: string; deviceId: string }[];
}

const iso = (d: string) => new Date(d).toISOString();

export function importId(r: RemoteEvent): string {
  return `ext-${r.calendarId}-${r.id}-${Date.parse(r.startDate)}`;
}

/** UTC-midnight all-day span → local 00:00 of the first day … 23:59 of the last day. */
export function allDayFromUtc(start: string, end: string): { startDate: string; endDate: string } {
  const s = new Date(start);
  const e = new Date(end);
  const first = new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  // The device end is exclusive (midnight after the last day).
  const lastUtc = new Date(Math.max(e.getTime() - 1, s.getTime()));
  const last = new Date(lastUtc.getUTCFullYear(), lastUtc.getUTCMonth(), lastUtc.getUTCDate(), 23, 59);
  return { startDate: first.toISOString(), endDate: last.toISOString() };
}

/** Local all-day span → the UTC-midnight, end-exclusive form Android's provider requires. */
export function allDayToUtc(startISO: string, endISO: string): { start: Date; end: Date } {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const start = new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()));
  const end = new Date(Date.UTC(e.getFullYear(), e.getMonth(), e.getDate() + 1));
  return { start, end: end > start ? end : new Date(start.getTime() + 86400000) };
}

export function remoteToLocal(r: RemoteEvent, opts: ImportOptions = {}): CalendarEvent {
  const notes = [r.location ? `📍 ${r.location}` : "", r.notes ?? ""].filter(Boolean).join("\n").slice(0, 4000);
  const span = r.allDay && opts.utcAllDay ? allDayFromUtc(r.startDate, r.endDate) : { startDate: iso(r.startDate), endDate: iso(r.endDate) };
  const reminder = r.alarmMinutes != null && r.alarmMinutes >= 0 ? r.alarmMinutes : opts.defaultReminder ?? 0;
  return {
    id: importId(r),
    title: r.title?.trim() || "(No title)",
    ...span,
    allDay: r.allDay || undefined,
    notes: notes || undefined,
    reminder: reminder > 0 ? reminder : undefined,
    source: "calendar",
    externalCalendarId: r.calendarId,
  };
}

function sameImported(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.title === b.title && a.startDate === b.startDate && a.endDate === b.endDate && !!a.allDay === !!b.allDay && (a.notes ?? "") === (b.notes ?? "") && (a.reminder ?? 0) === (b.reminder ?? 0);
}

/**
 * Bring imported events in line with the device: add/update what changed,
 * and drop imported events inside the synced window that disappeared, or
 * whose calendar is no longer selected.
 */
export function planImport(remote: RemoteEvent[], local: CalendarEvent[], selected: string[], window: { from: Date; to: Date }, opts: ImportOptions = {}): ImportPlan {
  const incoming = new Map(remote.filter((r) => selected.includes(r.calendarId)).map((r) => [importId(r), remoteToLocal(r, opts)]));
  const existing = new Map(local.filter((e) => e.source === "calendar").map((e) => [e.id, e]));
  const upserts: CalendarEvent[] = [];
  for (const [id, ev] of incoming) {
    const cur = existing.get(id);
    if (!cur || !sameImported(cur, ev)) upserts.push(ev);
  }
  const removeIds: string[] = [];
  for (const [id, ev] of existing) {
    if (incoming.has(id)) continue;
    const unselected = !ev.externalCalendarId || !selected.includes(ev.externalCalendarId);
    const t = Date.parse(ev.startDate);
    const inWindow = t >= window.from.getTime() && t <= window.to.getTime();
    if (unselected || inWindow) removeIds.push(id);
  }
  return { upserts, removeIds };
}

/** Bump to rewrite every exported event once (v2: all-day events written in UTC on Android). */
const HASH_VERSION = "v2";

export function eventHash(e: CalendarEvent): string {
  return [HASH_VERSION, e.title, e.startDate, e.endDate, e.allDay ? 1 : 0, e.notes ?? "", JSON.stringify(e.recurrence ?? null)].join("|");
}

/** Task deadlines as calendar entries: a 30-min block ending at the deadline, or all-day when no time was set. */
export function taskDeadlineEvents(todos: Todo[]): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const t of todos) {
    if (t.completed || !t.dueDate) continue;
    const due = new Date(t.dueDate);
    if (isNaN(due.getTime())) continue;
    const endOfDay = due.getHours() === 23 && due.getMinutes() === 59;
    const start = endOfDay ? new Date(due.getFullYear(), due.getMonth(), due.getDate()) : new Date(due.getTime() - 30 * 60000);
    out.push({
      id: `task-${t.id}`,
      title: `Due: ${t.title}`,
      startDate: start.toISOString(),
      endDate: due.toISOString(),
      allDay: endOfDay || undefined,
      notes: t.items?.length ? t.items.map((i, n) => `${i.done ? "✓" : "☐"} ${n + 1}. ${i.text}`).join("\n") : undefined,
      source: "manual",
    });
  }
  return out;
}

export function planExport(local: CalendarEvent[], records: Record<string, ExportRecord>): ExportPlan {
  // Never export what was imported (phone calendars or subscribed feeds).
  const exportable = local.filter((e) => e.source !== "calendar" && e.source !== "feed");
  const ids = new Set(exportable.map((e) => e.id));
  const plan: ExportPlan = { create: [], update: [], remove: [] };
  for (const e of exportable) {
    const rec = records[e.id];
    if (!rec) plan.create.push(e);
    else if (rec.hash !== eventHash(e)) plan.update.push({ event: e, deviceId: rec.deviceId });
  }
  for (const [localId, rec] of Object.entries(records)) {
    if (!ids.has(localId)) plan.remove.push({ localId, deviceId: rec.deviceId });
  }
  return plan;
}

/** Seishin recurrence → device recurrence rule (weekday numbers: device uses 1 = Sunday). */
export function toDeviceRecurrence(r?: Recurrence): { frequency: string; interval?: number; endDate?: string; daysOfTheWeek?: { dayOfTheWeek: number }[] } | null {
  if (!r) return null;
  return {
    frequency: r.frequency,
    interval: r.interval && r.interval > 1 ? r.interval : undefined,
    endDate: r.until ? new Date(`${r.until}T23:59:59`).toISOString() : undefined,
    daysOfTheWeek: r.frequency === "weekly" && r.weekdays?.length ? r.weekdays.map((d) => ({ dayOfTheWeek: d + 1 })) : undefined,
  };
}

export interface CalendarGroup<T> {
  account: string;
  calendars: T[];
}

/**
 * Phone calendars grouped by signed-in account for the connector UI. Calendars
 * the phone doesn't sync are dropped (they never hold events), and accounts
 * keep the input order, so the primary-first sort carries over.
 */
export function groupCalendarsByAccount<T extends { account: string; synced: boolean }>(cals: T[]): CalendarGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const c of cals) {
    if (!c.synced) continue;
    const list = groups.get(c.account);
    if (list) list.push(c);
    else groups.set(c.account, [c]);
  }
  return [...groups].map(([account, calendars]) => ({ account, calendars }));
}

interface AccountCalendar { id: string; account: string; synced: boolean; writable: boolean; primary: boolean }
export interface AccountSelection { accounts: string[]; importIds: string[]; exportId: string | null }

/** Accounts in use: the saved choice, or (installs from before account picking) every account with a shown calendar. */
export function chosenAccounts(saved: string[] | undefined, importIds: string[], cals: AccountCalendar[]): string[] {
  if (saved) return saved;
  const ids = new Set(importIds);
  return [...new Set(cals.filter((c) => ids.has(c.id)).map((c) => c.account))];
}

/**
 * Adds or removes an account. Adding shows all its synced calendars (and, on the
 * first pick, makes its primary calendar the save target); removing hides its
 * calendars and drops the save target if it lived there.
 */
export function setAccountChosen(sel: AccountSelection, cals: AccountCalendar[], account: string, on: boolean): AccountSelection {
  const mine = cals.filter((c) => c.account === account && c.synced);
  const ids = new Set(mine.map((c) => c.id));
  if (!on) {
    return {
      accounts: sel.accounts.filter((a) => a !== account),
      importIds: sel.importIds.filter((id) => !ids.has(id)),
      exportId: sel.exportId && ids.has(sel.exportId) ? null : sel.exportId,
    };
  }
  const firstPick = sel.accounts.length === 0 && sel.exportId === null;
  const target = mine.find((c) => c.writable && c.primary) ?? mine.find((c) => c.writable);
  return {
    accounts: sel.accounts.includes(account) ? sel.accounts : [...sel.accounts, account],
    importIds: [...new Set([...sel.importIds, ...ids])],
    exportId: firstPick && target ? target.id : sel.exportId,
  };
}

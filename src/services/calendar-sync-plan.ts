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

export function remoteToLocal(r: RemoteEvent): CalendarEvent {
  const notes = [r.location ? `📍 ${r.location}` : "", r.notes ?? ""].filter(Boolean).join("\n").slice(0, 4000);
  return {
    id: importId(r),
    title: r.title?.trim() || "(No title)",
    startDate: iso(r.startDate),
    endDate: iso(r.endDate),
    allDay: r.allDay || undefined,
    notes: notes || undefined,
    source: "calendar",
    externalCalendarId: r.calendarId,
  };
}

function sameImported(a: CalendarEvent, b: CalendarEvent): boolean {
  return a.title === b.title && a.startDate === b.startDate && a.endDate === b.endDate && !!a.allDay === !!b.allDay && (a.notes ?? "") === (b.notes ?? "");
}

/**
 * Bring imported events in line with the device: add/update what changed,
 * and drop imported events inside the synced window that disappeared, or
 * whose calendar is no longer selected.
 */
export function planImport(remote: RemoteEvent[], local: CalendarEvent[], selected: string[], window: { from: Date; to: Date }): ImportPlan {
  const incoming = new Map(remote.filter((r) => selected.includes(r.calendarId)).map((r) => [importId(r), remoteToLocal(r)]));
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

export function eventHash(e: CalendarEvent): string {
  return [e.title, e.startDate, e.endDate, e.allDay ? 1 : 0, e.notes ?? "", JSON.stringify(e.recurrence ?? null)].join("|");
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
  const exportable = local.filter((e) => e.source !== "calendar");
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

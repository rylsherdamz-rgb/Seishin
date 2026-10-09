/**
 * Phone-calendar connector. Reads/writes the device calendar provider, which
 * the phone keeps in sync with Google Calendar, Outlook, Samsung, etc. — so
 * Seishin syncs with them with no server and no extra sign-in.
 */
import * as Cal from "expo-calendar/legacy";
import { settingsStorage } from "@/stores/mmkv";
import { useCalendarStore, type CalendarEvent } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { createLogger } from "@/utils/logger";
import {
  eventHash, planExport, planImport, taskDeadlineEvents, toDeviceRecurrence,
  type ExportRecord, type RemoteEvent,
} from "./calendar-sync-plan";

const log = createLogger("calendar-sync");
const KEY = "settings:connectors:calendar";
const PAST_DAYS = 14;
const FUTURE_DAYS = 180;

export interface CalendarSyncState {
  enabled: boolean;
  /** Device calendars whose events appear in Seishin. */
  importIds: string[];
  /** Device calendar Seishin writes its events into (null = don't export). */
  exportId: string | null;
  exportTasks: boolean;
  lastSync: string | null;
  lastError: string | null;
  records: Record<string, ExportRecord>;
}

export interface DeviceCalendar {
  id: string;
  title: string;
  account: string;
  color: string;
  writable: boolean;
  primary: boolean;
}

export interface SyncSummary {
  imported: number;
  removed: number;
  exported: number;
  updated: number;
  deleted: number;
}

const DEFAULT: CalendarSyncState = {
  enabled: false, importIds: [], exportId: null, exportTasks: true, lastSync: null, lastError: null, records: {},
};

export function readSyncState(): CalendarSyncState {
  try {
    const raw = settingsStorage.getString(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<CalendarSyncState>) } : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeSyncState(patch: Partial<CalendarSyncState>): CalendarSyncState {
  const next = { ...readSyncState(), ...patch };
  try {
    settingsStorage.set(KEY, JSON.stringify(next));
  } catch (e) {
    log.error("could not save sync state", e);
  }
  return next;
}

export async function ensureCalendarPermission(): Promise<boolean> {
  try {
    const cur = await Cal.getCalendarPermissionsAsync();
    if (cur.granted) return true;
    return (await Cal.requestCalendarPermissionsAsync()).granted;
  } catch (e) {
    log.warn("calendar permission unavailable", e);
    return false;
  }
}

export async function listDeviceCalendars(): Promise<DeviceCalendar[]> {
  const cals = await Cal.getCalendarsAsync(Cal.EntityTypes.EVENT);
  return cals
    .map((c) => ({
      id: c.id,
      title: c.title || c.name || "Calendar",
      account: c.ownerAccount || c.source?.name || "This phone",
      color: c.color || "#888888",
      writable: !!c.allowsModifications,
      primary: !!c.isPrimary,
    }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.account.localeCompare(b.account) || a.title.localeCompare(b.title));
}

/** Sensible defaults on first connect: show every calendar, write to the primary writable one. */
export function suggestDefaults(cals: DeviceCalendar[]): Pick<CalendarSyncState, "importIds" | "exportId"> {
  const target = cals.find((c) => c.writable && c.primary) ?? cals.find((c) => c.writable) ?? null;
  return { importIds: cals.map((c) => c.id), exportId: target?.id ?? null };
}

async function runImport(state: CalendarSyncState): Promise<{ imported: number; removed: number }> {
  const from = new Date(Date.now() - PAST_DAYS * 86400000);
  const to = new Date(Date.now() + FUTURE_DAYS * 86400000);
  // Never re-import our own export target's Seishin-written events.
  const importIds = state.importIds;
  const remote: RemoteEvent[] = importIds.length
    ? (await Cal.getEventsAsync(importIds, from, to))
        .filter((e) => !Object.values(state.records).some((r) => r.deviceId === e.id))
        .map((e) => ({
          id: String(e.id), calendarId: String(e.calendarId), title: e.title,
          startDate: new Date(e.startDate).toISOString(), endDate: new Date(e.endDate).toISOString(),
          allDay: !!e.allDay, notes: e.notes, location: e.location,
        }))
    : [];
  const store = useCalendarStore.getState();
  const plan = planImport(remote, store.events, importIds, { from, to });
  store.applyImport(plan.upserts, plan.removeIds);
  return { imported: plan.upserts.length, removed: plan.removeIds.length };
}

function toDevice(e: CalendarEvent) {
  return {
    title: e.title,
    startDate: new Date(e.startDate),
    endDate: new Date(e.endDate),
    allDay: !!e.allDay,
    notes: [e.notes, "— Added by Seishin"].filter(Boolean).join("\n\n"),
    recurrenceRule: toDeviceRecurrence(e.recurrence) as Cal.RecurrenceRule | null,
    alarms: e.reminder ? [{ relativeOffset: -e.reminder }] : [],
  };
}

async function runExport(state: CalendarSyncState): Promise<{ exported: number; updated: number; deleted: number; records: Record<string, ExportRecord> }> {
  const records = { ...state.records };
  if (!state.exportId) return { exported: 0, updated: 0, deleted: 0, records };
  const events = [...useCalendarStore.getState().events];
  if (state.exportTasks) events.push(...taskDeadlineEvents(useTodoStore.getState().todos));
  const plan = planExport(events, records);
  let exported = 0;
  let updated = 0;
  let deleted = 0;
  for (const e of plan.create) {
    try {
      records[e.id] = { deviceId: await Cal.createEventAsync(state.exportId, toDevice(e)), hash: eventHash(e) };
      exported++;
    } catch (err) {
      log.warn("export create failed", e.id, err);
    }
  }
  for (const { event, deviceId } of plan.update) {
    try {
      await Cal.updateEventAsync(deviceId, toDevice(event));
      records[event.id] = { deviceId, hash: eventHash(event) };
      updated++;
    } catch {
      // Deleted on the device side: recreate next sync.
      delete records[event.id];
    }
  }
  for (const { localId, deviceId } of plan.remove) {
    try {
      await Cal.deleteEventAsync(deviceId);
    } catch {
      // Already gone on the device.
    }
    delete records[localId];
    deleted++;
  }
  return { exported, updated, deleted, records };
}

let running: Promise<SyncSummary | null> | null = null;

/** Full two-way sync. Concurrent calls share one run. Returns null when off / no permission. */
export function syncCalendars(opts: { exportOnly?: boolean } = {}): Promise<SyncSummary | null> {
  if (running) return running;
  running = (async () => {
    const state = readSyncState();
    if (!state.enabled) return null;
    if (!(await ensureCalendarPermission())) {
      writeSyncState({ lastError: "Calendar permission was denied" });
      return null;
    }
    try {
      // Sync can start at launch before any screen has loaded the stores; an
      // empty store would look like "everything was deleted" to the export
      // diff. Storage is always current (stores persist before publishing).
      useCalendarStore.getState().loadEvents();
      useTodoStore.getState().loadTodos();
      const imp = opts.exportOnly ? { imported: 0, removed: 0 } : await runImport(state);
      const exp = await runExport(state);
      writeSyncState({ records: exp.records, lastSync: new Date().toISOString(), lastError: null });
      return { ...imp, exported: exp.exported, updated: exp.updated, deleted: exp.deleted };
    } catch (e) {
      log.error("sync failed", e);
      writeSyncState({ lastError: e instanceof Error ? e.message : "Sync failed" });
      return null;
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Disconnect: stop syncing and remove Seishin-imported events (device calendars are untouched). */
export function disconnectCalendars(): void {
  const store = useCalendarStore.getState();
  store.applyImport([], store.events.filter((e) => e.source === "calendar").map((e) => e.id));
  // Keep the export mapping so reconnecting to the same calendar doesn't
  // write duplicate copies of events that are already there.
  writeSyncState({ ...DEFAULT, records: readSyncState().records });
}

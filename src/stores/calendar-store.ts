import { create } from "zustand";
import { eventsStorage } from "./mmkv";
import { occursOnDate, dateKey } from "@/utils/recurrence";
import { scheduleEventReminder, cancelEventReminder } from "@/services/notification-service";
import { NoteAttachment } from "@/stores/notes-store";
import { isNonEmptyString, isRecord, readList, sizeOf, writeJSON } from "./persist";

export interface Recurrence {
  frequency: "daily" | "weekly" | "monthly";
  /** Repeat every N days/weeks/months (default 1). */
  interval?: number;
  /** For weekly: which weekdays (0=Sun .. 6=Sat). Omit to repeat on the start weekday. */
  weekdays?: number[];
  /** Optional end date (YYYY-MM-DD). */
  until?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  /** Freeform note attached to this event. */
  notes?: string;
  /** Photos/files attached to the event's notes. */
  attachments?: NoteAttachment[];
  startDate: string;
  endDate: string;
  allDay?: boolean;
  source: "manual" | "ocr" | "email" | "notification" | "chat" | "ai" | "calendar" | "feed";
  /** For source "calendar"/"feed": the device calendar or feed it came from (read-only in Seishin). */
  externalCalendarId?: string;
  reminder?: number;
  /** Optional repeating schedule. */
  recurrence?: Recurrence;
}

interface CalendarState {
  events: CalendarEvent[];
  selectedDate: string;
  loadEvents: () => void;
  addEvent: (event: CalendarEvent) => boolean;
  updateEvent: (id: string, changes: Partial<CalendarEvent>) => boolean;
  deleteEvent: (id: string) => boolean;
  setSelectedDate: (date: string) => void;
  getEventsForDate: (date: string) => CalendarEvent[];
  /** Bulk upsert/remove for calendar sync — one write, no reminder churn. */
  applyImport: (upserts: CalendarEvent[], removeIds: string[]) => boolean;
  clearAll: () => void;
  getStorageSize: () => number;
}

// Storage key predates the `{domain}:{subdomain}:{id}` convention; kept so
// existing installs don't lose data.
const EVENTS_KEY = "events";
const SOURCES: CalendarEvent["source"][] = ["manual", "ocr", "email", "notification", "chat", "ai", "calendar", "feed"];
const isISODate = (x: unknown): x is string => typeof x === "string" && !isNaN(Date.parse(x));

/** Runtime guard for persisted events — anything malformed is dropped on load. */
export function isCalendarEvent(x: unknown): x is CalendarEvent {
  if (!isRecord(x)) return false;
  return (
    isNonEmptyString(x.id) &&
    typeof x.title === "string" &&
    isISODate(x.startDate) &&
    isISODate(x.endDate) &&
    SOURCES.includes(x.source as CalendarEvent["source"])
  );
}

/** Persist first, then publish to subscribers — UI never shows unsaved state. */
function commit(set: (s: Partial<CalendarState>) => void, events: CalendarEvent[]): boolean {
  if (!writeJSON(eventsStorage, EVENTS_KEY, events)) return false;
  set({ events });
  return true;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  selectedDate: dateKey(new Date()),

  loadEvents: () => {
    set({ events: readList(eventsStorage, EVENTS_KEY, isCalendarEvent) });
  },

  addEvent: (event) => {
    if (!isCalendarEvent(event)) return false;
    const ok = commit(set, [...get().events, event]);
    if (ok && event.reminder) scheduleEventReminder(event).catch(() => {});
    return ok;
  },

  updateEvent: (id, changes) => {
    const events = get().events.map((e) => (e.id === id ? { ...e, ...changes, id } : e));
    const updated = events.find((e) => e.id === id);
    if (!updated || !isCalendarEvent(updated) || !commit(set, events)) return false;
    if (updated.reminder) scheduleEventReminder(updated).catch(() => {});
    else if ("reminder" in changes) cancelEventReminder(id);
    return true;
  },

  deleteEvent: (id) => {
    const ok = commit(set, get().events.filter((e) => e.id !== id));
    if (ok) cancelEventReminder(id);
    return ok;
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  getEventsForDate: (date) => get().events.filter((e) => occursOnDate(e, date)),

  applyImport: (upserts, removeIds) => {
    if (upserts.length === 0 && removeIds.length === 0) return true;
    const drop = new Set(removeIds);
    const byId = new Map(get().events.filter((e) => !drop.has(e.id)).map((e) => [e.id, e]));
    for (const e of upserts) if (isCalendarEvent(e)) byId.set(e.id, e);
    return commit(set, [...byId.values()]);
  },

  clearAll: () => {
    get().events.forEach((e) => cancelEventReminder(e.id));
    eventsStorage.remove(EVENTS_KEY);
    set({ events: [] });
  },

  getStorageSize: () => sizeOf(eventsStorage, EVENTS_KEY),
}));

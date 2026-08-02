import { create } from "zustand";
import { eventsStorage } from "./mmkv";
import { occursOnDate, dateKey } from "@/utils/recurrence";
import { scheduleEventReminder, cancelEventReminder } from "@/services/notification-service";

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
  startDate: string;
  endDate: string;
  allDay?: boolean;
  source: "manual" | "ocr" | "email" | "notification" | "chat" | "ai";
  reminder?: number;
  /** Optional repeating schedule. */
  recurrence?: Recurrence;
}

interface CalendarState {
  events: CalendarEvent[];
  selectedDate: string;
  loadEvents: () => void;
  addEvent: (event: CalendarEvent) => void;
  updateEvent: (id: string, changes: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  setSelectedDate: (date: string) => void;
  getEventsForDate: (date: string) => CalendarEvent[];
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  selectedDate: dateKey(new Date()),

  loadEvents: () => {
    const raw = eventsStorage.getString("events");
    if (raw) {
      set({ events: JSON.parse(raw) });
    }
  },

  addEvent: (event) => {
    const events = [...get().events, event];
    eventsStorage.set("events", JSON.stringify(events));
    set({ events });
    if (event.reminder) scheduleEventReminder(event).catch(() => {});
  },

  updateEvent: (id, changes) => {
    const events = get().events.map((e) =>
      e.id === id ? { ...e, ...changes } : e
    );
    eventsStorage.set("events", JSON.stringify(events));
    set({ events });
    const updated = get().events.find((e) => e.id === id);
    if (updated) {
      if (updated.reminder) scheduleEventReminder(updated).catch(() => {});
      else if ("reminder" in changes) cancelEventReminder(id);
    }
  },

  deleteEvent: (id) => {
    const events = get().events.filter((e) => e.id !== id);
    eventsStorage.set("events", JSON.stringify(events));
    set({ events });
    cancelEventReminder(id);
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  getEventsForDate: (date) => {
    return get().events.filter((e) => occursOnDate(e, date));
  },
}));

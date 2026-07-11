import { create } from "zustand";
import { eventsStorage } from "./mmkv";

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
  selectedDate: new Date().toISOString().split("T")[0],

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
  },

  updateEvent: (id, changes) => {
    const events = get().events.map((e) =>
      e.id === id ? { ...e, ...changes } : e
    );
    eventsStorage.set("events", JSON.stringify(events));
    set({ events });
  },

  deleteEvent: (id) => {
    const events = get().events.filter((e) => e.id !== id);
    eventsStorage.set("events", JSON.stringify(events));
    set({ events });
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  getEventsForDate: (date) => {
    return get().events.filter((e) => e.startDate.startsWith(date));
  },
}));

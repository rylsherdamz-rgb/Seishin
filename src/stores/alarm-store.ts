import { create } from "zustand";

export interface ActiveAlarm {
  title: string;
  body?: string;
  eventId?: string;
  /** ISO time of the schedule (the event start / alarm time). */
  startTime?: string;
  /** ISO end time of the event, if known. */
  endTime?: string;
  /** Freeform notes for the event, if any. */
  notes?: string;
  snoozed: boolean;
}

interface AlarmState {
  alarm: ActiveAlarm | null;
  trigger: (alarm: ActiveAlarm) => void;
  dismiss: () => void;
}

export const useAlarmStore = create<AlarmState>((set) => ({
  alarm: null,
  trigger: (alarm) => set({ alarm }),
  dismiss: () => set({ alarm: null }),
}));
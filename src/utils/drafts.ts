import { settingsStorage } from "@/stores/mmkv";

export interface TodoDraft {
  title?: string;
  dueDate?: string;
}

export interface EventDraft {
  title?: string;
  notes?: string;
  /** ISO datetime — carries both the chosen date and time. */
  startDate?: string;
  /** ISO datetime — carries the chosen end time (same day as start). */
  endDate?: string;
  repeatMode?: string;
  customWeekdays?: number[];
  reminderMinutes?: number;
}

function read<T>(key: string): T | undefined {
  const raw = settingsStorage.getString(key);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as T; } catch { return undefined; }
}

// — Todo form draft —

const TODO_DRAFT_KEY = "todoDraft";

export function saveTodoDraft(draft: TodoDraft) {
  settingsStorage.set(TODO_DRAFT_KEY, JSON.stringify(draft));
}

export function loadTodoDraft(): TodoDraft {
  return read<TodoDraft>(TODO_DRAFT_KEY) ?? {};
}

export function clearTodoDraft() {
  settingsStorage.set(TODO_DRAFT_KEY, JSON.stringify({}));
}

// — Event form draft --------------------------------------------------

const EVENT_DRAFT_KEY = "eventDraft";

export function saveEventDraft(draft: EventDraft) {
  settingsStorage.set(EVENT_DRAFT_KEY, JSON.stringify(draft));
}

export function loadEventDraft(): EventDraft {
  return read<EventDraft>(EVENT_DRAFT_KEY) ?? {};
}

export function clearEventDraft() {
  settingsStorage.set(EVENT_DRAFT_KEY, JSON.stringify({}));
}
import { settingsStorage } from "@/stores/mmkv";
import type { ReminderLevel } from "@/services/reminder-plan";

/** Non-secret connector settings (tokens live in secrets.ts). */
export interface ConnectorStatus {
  enabled: boolean;
  lastSync: string | null;
  lastError: string | null;
}

export interface TodoistState extends ConnectorStatus {
  reminder: ReminderLevel;
}

export interface NotionState extends ConnectorStatus {
  reminder: ReminderLevel;
  databaseId: string;
  dataSourceId: string | null;
  titleProp: string | null;
  dateProp: string | null;
  doneProp: string | null;
  doneType: "checkbox" | "status" | null;
  /** Status option names that count as done. */
  doneNames: string[];
}

export interface Feed extends ConnectorStatus {
  id: string;
  name: string;
  url: string;
  /** "auto": deadline-like entries become tasks with reminders, the rest events. */
  mode: "auto" | "events";
  reminder: ReminderLevel;
}

const BASE: ConnectorStatus = { enabled: false, lastSync: null, lastError: null };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = settingsStorage.getString(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    settingsStorage.set(key, JSON.stringify(value));
  } catch {
    // Settings write failure: the next sync retries with the old state.
  }
}

const TODOIST = "settings:connectors:todoist";
const NOTION = "settings:connectors:notion";
const FEEDS = "settings:connectors:feeds";

export const todoistState = {
  get: (): TodoistState => read(TODOIST, { ...BASE, reminder: "normal" as ReminderLevel }),
  set: (p: Partial<TodoistState>) => { const n = { ...todoistState.get(), ...p }; write(TODOIST, n); return n; },
};

export const notionState = {
  get: (): NotionState => read(NOTION, {
    ...BASE, reminder: "normal" as ReminderLevel, databaseId: "", dataSourceId: null,
    titleProp: null, dateProp: null, doneProp: null, doneType: null, doneNames: [],
  }),
  set: (p: Partial<NotionState>) => { const n = { ...notionState.get(), ...p }; write(NOTION, n); return n; },
};

export const feedsState = {
  get: (): Feed[] => {
    try {
      const raw = settingsStorage.getString(FEEDS);
      return raw ? (JSON.parse(raw) as Feed[]) : [];
    } catch {
      return [];
    }
  },
  set: (feeds: Feed[]) => { write(FEEDS, feeds); return feeds; },
  patch: (id: string, p: Partial<Feed>) => feedsState.set(feedsState.get().map((f) => (f.id === id ? { ...f, ...p } : f))),
};

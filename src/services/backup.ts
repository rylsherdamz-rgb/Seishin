/**
 * Backup & restore (pure part — unit-tested). A backup is one JSON file with
 * events, tasks, notes and non-secret preferences. Secrets (API keys,
 * connector tokens) are never included. Photos/files attached to notes are
 * referenced by their on-phone path only, so they restore on the same phone
 * but not on a new one.
 */
import { isCalendarEvent, type CalendarEvent } from "@/stores/calendar-store";
import { isTodo, type Todo } from "@/stores/todo-store";
import type { Note } from "@/stores/notes-store";
import { isRecord } from "@/stores/persist";

export const BACKUP_VERSION = 1;

export interface Backup {
  app: "seishin";
  version: number;
  createdAt: string;
  events: CalendarEvent[];
  todos: Todo[];
  notes: Note[];
  prefs: Record<string, string>;
}

export interface BackupCounts {
  events: number;
  todos: number;
  notes: number;
}

/** Preference keys safe to carry between phones (no secrets, no device ids). */
export const PORTABLE_PREF_KEYS = [
  "settings:theme:mode", "settings:theme:accent", "settings:notes:layout",
  "cleanupPolicies", "nimEndpoint", "nimModel", "nimLargeModel", "alarmRingtoneName",
];

export function buildBackup(events: CalendarEvent[], todos: Todo[], notes: Note[], prefs: Record<string, string>, now = new Date()): Backup {
  return {
    app: "seishin",
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    // Synced copies come back on their own after reconnecting; don't freeze them into the backup.
    events: events.filter((e) => e.source !== "calendar" && e.source !== "feed"),
    todos,
    notes,
    prefs: Object.fromEntries(Object.entries(prefs).filter(([k]) => PORTABLE_PREF_KEYS.includes(k))),
  };
}

function isNote(x: unknown): x is Note {
  return isRecord(x) && typeof x.id === "string" && typeof x.title === "string" && typeof x.body === "string";
}

/** Parse + validate a backup file. Throws a user-readable Error when unusable. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a Seishin backup (not valid JSON).");
  }
  if (!isRecord(raw) || raw.app !== "seishin") throw new Error("This file isn't a Seishin backup.");
  if (typeof raw.version !== "number" || raw.version > BACKUP_VERSION) {
    throw new Error("This backup was made by a newer version of Seishin. Update the app first.");
  }
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const prefs = isRecord(raw.prefs)
    ? Object.fromEntries(Object.entries(raw.prefs).filter(([k, v]) => PORTABLE_PREF_KEYS.includes(k) && typeof v === "string")) as Record<string, string>
    : {};
  return {
    app: "seishin",
    version: raw.version,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    events: list(raw.events).filter(isCalendarEvent),
    todos: list(raw.todos).filter(isTodo),
    notes: list(raw.notes).filter(isNote).map((n) => ({
      ...n,
      tags: Array.isArray(n.tags) ? n.tags : [],
      attachments: Array.isArray(n.attachments) ? n.attachments : [],
      pinned: n.pinned === true,
      createdAt: n.createdAt || new Date(0).toISOString(),
      updatedAt: n.updatedAt || new Date(0).toISOString(),
    })),
    prefs,
  };
}

export function countBackup(b: Pick<Backup, "events" | "todos" | "notes">): BackupCounts {
  return { events: b.events.length, todos: b.todos.length, notes: b.notes.length };
}

/**
 * Merge: everything from both sides, matched by id. For notes the most
 * recently edited copy wins; for events and tasks the copy already on the
 * phone wins (it may have newer edits than the backup).
 */
export function mergeById<T extends { id: string }>(current: T[], incoming: T[], newer?: (a: T, b: T) => boolean): T[] {
  const byId = new Map(current.map((x) => [x.id, x]));
  for (const x of incoming) {
    const cur = byId.get(x.id);
    if (!cur || (newer && newer(x, cur))) byId.set(x.id, x);
  }
  return [...byId.values()];
}

export const noteIsNewer = (a: Note, b: Note) => a.updatedAt > b.updatedAt;

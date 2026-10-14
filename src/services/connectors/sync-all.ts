import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { settingsStorage } from "@/stores/mmkv";
import { createLogger } from "@/utils/logger";

const log = createLogger("sync-all");
const LAST_KEY = "settings:connectors:lastRun";

export interface SyncReport {
  at: string;
  reason: string;
  changes: number;
  errors: string[];
}

let running: Promise<SyncReport> | null = null;

/**
 * Sync every connector once: phone calendars, calendar feeds, Todoist and
 * Notion, then top up task reminders. Shared by app launch, foreground,
 * pull-to-refresh and the background task; concurrent calls share one run.
 * `light` skips network-heavy pulls (used right after local edits).
 * `local` only re-reads the phone calendars (cheap, no network) — used every
 * time the app comes back so edits made in Google Calendar show up at once.
 */
export function syncEverything(reason: string, opts: { light?: boolean; local?: boolean } = {}): Promise<SyncReport> {
  if (running) return running;
  running = (async () => {
    const errors: string[] = [];
    let changes = 0;
    // Background runs start cold: load the stores from storage first.
    useCalendarStore.getState().loadEvents();
    useTodoStore.getState().loadTodos();
    const step = async (name: string, fn: () => Promise<number | unknown>) => {
      try {
        const n = await fn();
        if (typeof n === "number") changes += n;
      } catch (e) {
        log.warn(`${name} failed`, e);
        errors.push(name);
      }
    };
    const { syncCalendars } = require("@/services/calendar-sync") as typeof import("@/services/calendar-sync");
    await step("calendar", async () => {
      const r = await syncCalendars({ exportOnly: opts.light });
      return r ? r.imported + r.removed + r.exported + r.updated + r.deleted : 0;
    });
    const { syncTodoist } = require("./todoist") as typeof import("./todoist");
    const { syncNotion } = require("./notion") as typeof import("./notion");
    if (!opts.local) {
      await step("todoist", syncTodoist);
      await step("notion", syncNotion);
    }
    if (!opts.light && !opts.local) {
      const { syncFeeds } = require("./feeds") as typeof import("./feeds");
      await step("feeds", syncFeeds);
      const { refreshAllTaskReminders } = require("@/services/task-reminders") as typeof import("@/services/task-reminders");
      await step("reminders", () => refreshAllTaskReminders(useTodoStore.getState().todos));
    }
    // New/moved events from Google & co. get their alarms even when the app is closed.
    const { refreshEventAlarms } = require("@/services/event-alarms") as typeof import("@/services/event-alarms");
    await step("alarms", async () => { await refreshEventAlarms(useCalendarStore.getState().events); });
    const { updateWidgets } = require("@/widgets/update") as typeof import("@/widgets/update");
    await step("widgets", async () => { await updateWidgets(); });
    const report = { at: new Date().toISOString(), reason, changes, errors };
    try { settingsStorage.set(LAST_KEY, JSON.stringify(report)); } catch { /* informational only */ }
    return report;
  })().finally(() => { running = null; });
  return running;
}

export function lastSyncReport(): SyncReport | null {
  try {
    const raw = settingsStorage.getString(LAST_KEY);
    return raw ? (JSON.parse(raw) as SyncReport) : null;
  } catch {
    return null;
  }
}

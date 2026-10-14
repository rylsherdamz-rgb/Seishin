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

/** Live (every-minute) runs skip these until enough time has passed. */
const FEEDS_GAP = 5 * 60000; // .ics feeds change rarely; be polite to school servers
const REMINDERS_GAP = 30 * 60000; // top-up reschedules from "now" — every minute would keep nags from ever firing
let lastFeeds = 0;
let lastReminders = 0;

let running: Promise<SyncReport> | null = null;
let queued: Promise<SyncReport> | null = null;
/** What the queued run will do; a full request upgrades a queued light one. */
let queuedReq: { reason: string; light: boolean; local: boolean } | null = null;

interface SyncOpts {
  light?: boolean;
  local?: boolean;
}

/**
 * Sync every connector once: phone calendars, calendar feeds, Todoist and
 * Notion, then top up task reminders. Shared by app launch, foreground,
 * pull-to-refresh, the live minute tick and the background task. A call made
 * mid-run queues exactly one follow-up run, so an edit made while a sync is in
 * flight is still pushed. `light` skips network-heavy pulls (post-edit pushes).
 * `local` only re-reads the phone calendars (cheap, no network) — used after
 * connecting calendars so they show up at once.
 */
export function syncEverything(reason: string, opts: SyncOpts = {}): Promise<SyncReport> {
  if (running) {
    const req = { light: !!opts.light, local: !!opts.local };
    // Queued requests merge so the follow-up run covers all of their work.
    queuedReq = queuedReq
      ? { reason: queuedReq.reason, light: queuedReq.light && req.light, local: queuedReq.local && req.local }
      : { reason, ...req };
    queued ??= running.catch(() => undefined).then(() => {
      const next = queuedReq ?? { reason, ...req };
      queued = null;
      queuedReq = null;
      return syncEverything(next.reason, { light: next.light, local: next.local });
    });
    return queued;
  }
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
    const now = Date.now();
    // Frequent triggers (minute tick, every app resume) respect the gaps; launch,
    // manual and background runs always do everything.
    const live = reason === "live" || reason === "foreground";
    const full = !opts.light && !opts.local;
    if (full && (!live || now - lastFeeds > FEEDS_GAP)) {
      lastFeeds = now;
      const { syncFeeds } = require("./feeds") as typeof import("./feeds");
      await step("feeds", syncFeeds);
    }
    if (full && (!live || now - lastReminders > REMINDERS_GAP)) {
      lastReminders = now;
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

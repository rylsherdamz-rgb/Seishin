/**
 * Factory reset that actually resets: storage, in-memory stores (or deleted
 * data would stay on screen and be written back by the next edit), scheduled
 * alarms/reminders (or they'd keep firing for deleted items), Keystore secrets
 * and the background sync task.
 */
import * as Notifications from "expo-notifications";
import { clearAllStorage } from "@/stores/mmkv";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useNotesStore } from "@/stores/notes-store";
import { useInboxStore } from "@/stores/inbox-store";
import { useAgentStore } from "@/stores/agent-store";
import { useInvitesStore } from "@/stores/invites-store";
import { useAlarmStore } from "@/stores/alarm-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useThemeStore } from "@/stores/theme-store";
import { clearOcrHistory } from "./ocr";
import { deleteToken } from "./connectors/secrets";
import { createLogger } from "@/utils/logger";

const log = createLogger("factory-reset");

/** Every secret name ever written via connectors/secrets.ts. */
const SECRET_NAMES = ["nim", "email", "todoist", "notion"];

export interface ResetResult {
  ok: boolean;
  failed: string[];
}

export async function factoryReset(): Promise<ResetResult> {
  const failed: string[] = [];
  const step = async (name: string, fn: () => unknown) => {
    try {
      await fn();
    } catch (e) {
      log.error(`${name} failed`, e);
      failed.push(name);
    }
  };

  await step("notifications", () => Notifications.cancelAllScheduledNotificationsAsync());
  await step("secrets", () => Promise.all(SECRET_NAMES.map(deleteToken)));
  await step("background", async () => {
    const { BACKGROUND_SYNC_TASK } = require("./background-sync") as typeof import("./background-sync");
    const BackgroundTask = require("expo-background-task") as typeof import("expo-background-task");
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  });
  await step("storage", () => {
    clearAllStorage();
    clearOcrHistory();
  });
  await step("memory", () => {
    // Back to the state each store had on app launch (actions included).
    for (const store of [useCalendarStore, useTodoStore, useNotesStore, useInboxStore, useAgentStore, useInvitesStore, useAlarmStore, useSettingsStore]) {
      (store as { setState: (s: unknown, replace: true) => void; getInitialState: () => unknown }).setState(store.getInitialState(), true);
    }
    useCalendarStore.setState({ events: [] });
    useTodoStore.setState({ todos: [] });
    useNotesStore.setState({ notes: [] });
    useThemeStore.getState().clearAll();
  });
  return { ok: failed.length === 0, failed };
}

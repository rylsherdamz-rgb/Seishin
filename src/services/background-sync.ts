/**
 * Background auto-sync: Android WorkManager / iOS BGTask via
 * expo-background-task. Runs roughly every 30 minutes (the OS decides the
 * exact time, batching for battery) even when Seishin is closed, and keeps
 * calendars, connectors and persistent reminders fresh.
 *
 * The task must be defined at module load, so this file is imported from the
 * root layout.
 */
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { createLogger } from "@/utils/logger";

const log = createLogger("background-sync");
export const BACKGROUND_SYNC_TASK = "seishin-background-sync";

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const { syncEverything } = require("./connectors/sync-all") as typeof import("./connectors/sync-all");
    await syncEverything("background");
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    log.error("background sync failed", e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(minutes = 30): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      log.warn("background tasks restricted on this device");
      return false;
    }
    if (!(await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK))) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: minutes });
    }
    return true;
  } catch (e) {
    log.warn("could not register background sync", e);
    return false;
  }
}

export async function backgroundSyncAvailable(): Promise<boolean> {
  try {
    return (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available;
  } catch {
    return false;
  }
}

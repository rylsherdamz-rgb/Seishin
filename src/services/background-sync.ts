/**
 * Background auto-sync: Android WorkManager / iOS BGTask via
 * expo-background-task. Asks for the OS minimum (15 minutes — WorkManager
 * will not run periodic work more often; the OS may still batch it later for
 * battery) so calendars, connectors and persistent reminders stay fresh even
 * when Seishin is closed. While the app is open, useAutoSync syncs live.
 *
 * The task must be defined at module load, so this file is imported from the
 * root layout.
 */
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import { settingsStorage } from "@/stores/mmkv";
import { createLogger } from "@/utils/logger";

const log = createLogger("background-sync");
export const BACKGROUND_SYNC_TASK = "seishin-background-sync";
/** Shortest periodic interval Android's WorkManager allows. */
export const BACKGROUND_MIN_MINUTES = 15;
const INTERVAL_KEY = "settings:connectors:bgInterval";

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

export async function registerBackgroundSync(minutes = BACKGROUND_MIN_MINUTES): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      log.warn("background tasks restricted on this device");
      return false;
    }
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    // Older installs registered at 30 min: re-register so the new interval applies.
    if (registered && settingsStorage.getNumber(INTERVAL_KEY) === minutes) return true;
    if (registered) await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: minutes });
    settingsStorage.set(INTERVAL_KEY, minutes);
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

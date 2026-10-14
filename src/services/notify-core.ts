/**
 * Low-level notification plumbing shared by event alarms, task reminders and
 * the notification UI: permission, Android channels and the optional native
 * full-screen alarm module.
 */
import { NativeModules, Platform } from "react-native";
import * as Notifications from "expo-notifications";

/** Native full-screen alarm module (background/locked-screen rings). Absent in builds without it. */
export const NativeAlarm = NativeModules.AlarmFullScreen as
  | {
      scheduleAlarm: (id: string, title: string, body: string, startTimeMs: number, fireAtMs: number, expoNotifId: string | null, endTimeMs: number, notes: string) => void;
      cancelAlarms: (prefix: string) => void;
      pickRingtone: (currentUri: string | null) => Promise<{ uri: string | null; name: string } | null>;
      setAlarmSound: (uri: string | null) => void;
      startRinging: () => void;
      stopRinging: () => void;
    }
  | undefined;

export const ALARM_CHANNEL = "event-alarm";
export const REMINDER_CHANNEL = "event-reminders";

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

let channelsReady: Promise<void> | null = null;

/**
 * Android drops notifications posted to a channel that doesn't exist yet, so
 * every scheduler awaits this first. Created once per app run.
 */
export function ensureEventChannels(): Promise<void> {
  if (Platform.OS !== "android") return Promise.resolve();
  if (!channelsReady) {
    channelsReady = (async () => {
      try {
        await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
          name: "Event alarm",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250, 250, 250],
        });
        await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
          name: "Calendar reminders",
          description: "Reminders for events synced from your phone calendars",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 120, 200],
        });
      } catch {
        channelsReady = null;
      }
    })();
  }
  return channelsReady;
}

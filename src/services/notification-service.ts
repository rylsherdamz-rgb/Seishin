import { useEffect, useRef } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
/** Shape of a posted notification, as parsed for event suggestions. */
export interface NotificationData {
  id: string; title: string; text: string; bigText?: string; subText?: string;
  appName: string; packageName: string; postTime: number;
}
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { useAlarmStore } from "@/stores/alarm-store";
import type { CalendarEvent } from "@/stores/calendar-store";
import { NativeAlarm, ensureNotificationPermission, ensureEventChannels } from "./notify-core";
import { refreshEventAlarms } from "./event-alarms";
import { createLogger } from "@/utils/logger";

const log = createLogger("notifications");

/** Start looping the alarm sound while the foreground overlay is visible. */
export function startAlarmRinging(): void {
  if (Platform.OS !== "android") return;
  try { NativeAlarm?.startRinging(); } catch {}
}

/** Stop the looping alarm sound. */
export function stopAlarmRinging(): void {
  if (Platform.OS !== "android") return;
  try { NativeAlarm?.stopRinging(); } catch {}
}

/**
 * Open the Android system ringtone picker (alarm type). Resolves with the
 * chosen `{ uri, name }`, or `null` if the picker was cancelled or is
 * unavailable (e.g. on iOS). Android only.
 */
export async function pickAlarmRingtone(
  currentUri: string | null,
): Promise<{ uri: string | null; name: string } | null> {
  if (Platform.OS !== "android" || !NativeAlarm?.pickRingtone) return null;
  return NativeAlarm.pickRingtone(currentUri);
}

/**
 * Persist the chosen alarm sound natively and rebuild the alarm channel so it
 * takes effect. Pass `null` to fall back to the system default alarm sound.
 */
export function applyAlarmRingtone(uri: string | null): void {
  if (Platform.OS !== "android") return;
  try {
    NativeAlarm?.setAlarmSound(uri);
  } catch {}
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    // Event alarms take over the screen via the in-app AlarmOverlay, so
    // suppress the banner; the sound comes from the alarm channel.
    if (data?.type === "event-alarm") {
      return {
        shouldShowAlert: false,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export { ensureNotificationPermission, refreshEventAlarms };
export { scheduleEventReminder, cancelEventReminder } from "./event-alarms";

/** @deprecated kept for callers; creates every event channel. */
export const ensureAlarmChannel = ensureEventChannels;

export function useNotifications() {
  const { addItem } = useInboxStore();
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    refreshAllReminders().catch((e) => log.error("init failed:", e));

    // The app's own scheduled reminders (event/todo alarms) land in the Inbox
    // history when they fire while the app is in the foreground.
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === "event-alarm") {
        // Foreground: take over the screen with the stock-alarm overlay.
        const payload = {
          title: notification.request.content.title || "Alarm",
          body: notification.request.content.body ?? undefined,
          eventId: typeof data.eventId === "string" ? data.eventId : undefined,
          startTime: typeof data.startTime === "string" ? data.startTime : undefined,
          endTime: typeof data.endTime === "string" ? data.endTime : undefined,
          notes: typeof data.notes === "string" ? data.notes : undefined,
        };
        lastAlarmPayload.current = payload;
        useAlarmStore.getState().trigger({ ...payload, snoozed: false });
        return;
      }
      if (data?.type !== "event-reminder" && data?.type !== "todo-reminder" && data?.type !== "task-nag") return;
      addItem({
        id: `own-${notification.request.identifier || Date.now()}`,
        type: "notification",
        title: notification.request.content.title || "Reminder",
        body: notification.request.content.body || "",
        timestamp: new Date(notification.date).toISOString(),
        source: "Seishin",
        read: false,
      });
    });

    // Taps and "Mark done" / "Remind me in 1 hour" on task reminders — must be
    // registered whether or not notification-listener access was granted.
    const onResponse = (response: Notifications.NotificationResponse, coldStart = false) => {
      const data = response.notification.request.content.data;
      if (data?.type === "task-nag" && typeof data.todoId === "string") {
        // Cold start: let the splash hand over to the tabs before opening the task.
        handleTaskResponse(data.todoId, response.actionIdentifier, coldStart ? 1200 : 0).catch(() => {});
        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
          Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
        }
      }
    };
    const responseSub = Notifications.addNotificationResponseReceivedListener(onResponse);
    // The app was launched by the tap/action itself (it was closed).
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) {
          onResponse(r, true);
          Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
        }
      })
      .catch(() => {});

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
      subscription.remove();
    };
  }, []);

}

export function parseNotificationForEvent(data: NotificationData): CalendarEvent | null {
  const text = `${data.title} ${data.text} ${data.bigText} ${data.subText}`;
  const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(?:am|pm)?/i);
  const dateMatch = text.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4})?)/i);

  if (timeMatch || dateMatch) {
    const now = new Date();
    const eventDate = new Date(now);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const isPM = timeMatch[0].toLowerCase().includes("pm");
      if (isPM && hours !== 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
      eventDate.setHours(hours, minutes, 0, 0);
    }
    return {
      id: `notif-event-${data.id}-${Date.now()}`,
      title: data.title || "From Notification",
      startDate: eventDate.toISOString(),
      endDate: new Date(eventDate.getTime() + 3600000).toISOString(),
      source: "notification",
      description: data.text || data.bigText,
    };
  }
  return null;
}

/** The most recently fired alarm, used to re-fire a snoozed alarm. */
const lastAlarmPayload = {
  current: undefined as
    | { title: string; body?: string; eventId?: string; startTime?: string; endTime?: string; notes?: string }
    | undefined,
};

/** Re-fire the last alarm after a snooze. */
export async function snoozeAlarm(minutes = 1): Promise<void> {
  const payload = lastAlarmPayload.current;
  if (!payload) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await ensureEventChannels();
  const fireDate = new Date(Date.now() + minutes * 60 * 1000);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        sound: Platform.OS === "ios" ? "default" : undefined,
        data: {
          type: "event-alarm",
          eventId: payload.eventId,
          startTime: payload.startTime,
          endTime: payload.endTime,
          notes: payload.notes,
          snoozed: true,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
        channelId: Platform.OS === "android" ? "event-alarm" : undefined,
      },
    });
  } catch {}
}

/**
 * Everything that must be true for reminders to ring, run on every launch:
 * permission, channels, every upcoming event alarm (incl. synced Google
 * events) and the rolling task-reminder top-up.
 */
export async function refreshAllReminders(): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  await ensureEventChannels();
  const { useCalendarStore } = require("@/stores/calendar-store") as typeof import("@/stores/calendar-store");
  const { useTodoStore } = require("@/stores/todo-store") as typeof import("@/stores/todo-store");
  const { refreshAllTaskReminders } = require("./task-reminders") as typeof import("./task-reminders");
  if (useCalendarStore.getState().events.length === 0) useCalendarStore.getState().loadEvents();
  if (useTodoStore.getState().todos.length === 0) useTodoStore.getState().loadTodos();
  try { await refreshEventAlarms(useCalendarStore.getState().events); } catch (e) { log.warn("event alarm refresh failed", e); }
  try { await refreshAllTaskReminders(useTodoStore.getState().todos); } catch (e) { log.warn("task reminder refresh failed", e); }
}

/** Notification tap / action on a task reminder. */
async function handleTaskResponse(todoId: string, action: string, openDelay = 0) {
  const { useTodoStore } = await import("@/stores/todo-store");
  const { ACTION_DONE, ACTION_SNOOZE, snoozeTask } = await import("./task-reminders");
  const store = useTodoStore.getState();
  if (store.todos.length === 0) store.loadTodos();
  const todo = useTodoStore.getState().todos.find((t) => t.id === todoId);
  if (!todo) return;
  if (action === ACTION_DONE) {
    if (!todo.completed) useTodoStore.getState().toggleTodo(todoId);
    return;
  }
  if (action === ACTION_SNOOZE) {
    await snoozeTask(todo, 60);
    return;
  }
  const { router } = await import("expo-router");
  setTimeout(() => router.push({ pathname: "/task", params: { id: todoId } }), openDelay);
}

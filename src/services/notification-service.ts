import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState, AppStateStatus, NativeModules } from "react-native";
import * as Notifications from "expo-notifications";
import NotificationListener from "expo-android-notification-listener-service";
import type { NotificationData } from "expo-android-notification-listener-service";
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { useAlarmStore } from "@/stores/alarm-store";
import { CalendarEvent } from "@/stores/calendar-store";
import { settingsStorage } from "@/stores/mmkv";
import { expandOccurrences, eventStartDate } from "@/utils/recurrence";
import { createLogger } from "@/utils/logger";

const log = createLogger("notifications");

/** Native full-screen alarm module (background/locked-screen rings). */
const NativeAlarm = NativeModules.AlarmFullScreen as
  | {
      scheduleAlarm: (id: string, title: string, body: string, startTimeMs: number, fireAtMs: number, expoNotifId: string | null, endTimeMs: number, notes: string) => void;
      cancelAlarms: (prefix: string) => void;
      pickRingtone: (currentUri: string | null) => Promise<{ uri: string | null; name: string } | null>;
      setAlarmSound: (uri: string | null) => void;
      startRinging: () => void;
      stopRinging: () => void;
    }
  | undefined;

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

export type { NotificationData };

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

export function ensureNotificationPermission(): Promise<boolean> {
  return Notifications.getPermissionsAsync().then(async (settings) => {
    if (settings.granted) return true;
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  });
}

export async function ensureAlarmChannel() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("event-alarm", {
      name: "Event alarm",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250, 250, 250],
    });
  } catch {}
}

export function useNotifications() {
  const { addItem } = useInboxStore();
  const listenerRef = useRef<any>(null);
  const responseListenerRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
        (async () => {
      try {
        const granted = await ensureNotificationPermission();
        await ensureAlarmChannel();
        if (granted) {
          try { await scheduleTodayReminders(); } catch {}
        }
      } catch (e) {
        log.error("init failed:", e);
      }
    })();

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
      if (data?.type !== "event-reminder" && data?.type !== "todo-reminder") return;
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

    if (Platform.OS !== "android") {
      return () => { receivedSub.remove(); };
    }

    const granted = NotificationListener.isNotificationPermissionGranted();
    if (!granted) return;

    const sub = NotificationListener.addListener(
      "onNotificationReceived",
      (data: NotificationData) => {
        handleNotificationData(data);
      }
    );
    listenerRef.current = sub;

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "event-reminder") {
        // Navigate to calendar if we get an event reminder tap
      }
    });
    responseListenerRef.current = responseSub;

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      appState.current = nextAppState;
    });

    return () => {
      receivedSub.remove();
      sub.remove();
      if (responseSub) responseSub.remove();
      subscription.remove();
    };
  }, []);

  function handleNotificationData(data: NotificationData) {
    const parsed = parseNotificationForEvent(data);
    const item: InboxItem = {
      id: `notif-${data.id}-${Date.now()}`,
      type: "notification",
      title: data.title || data.appName,
      body: data.text || data.bigText || "",
      timestamp: new Date(data.postTime).toISOString(),
      source: data.appName || data.packageName,
      read: false,
      pendingEvent: parsed
        ? { title: parsed.title, startDate: parsed.startDate, endDate: parsed.endDate, description: parsed.description }
        : undefined,
    };
    addItem(item);
  }

  const isGranted = useCallback(async () => {
    return NotificationListener.isNotificationPermissionGranted();
  }, []);

  const openSettings = useCallback(() => {
    NotificationListener.openNotificationListenerSettings();
  }, []);

  return { isGranted, openSettings };
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

// One scheduled notification id per event occurrence, so re-running
// scheduleTodayReminders (e.g. on every app open) cancels the previous
// alarm instead of stacking duplicate alarms for the same event.
const REMINDER_MAP_KEY = "eventReminderNotifs";

function loadReminderMap(): Record<string, string> {
  const raw = settingsStorage.getString(REMINDER_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveReminderMap(map: Record<string, string>) {
  settingsStorage.set(REMINDER_MAP_KEY, JSON.stringify(map));
}

/** The most recently fired alarm, used to re-fire a snoozed alarm. */
const lastAlarmPayload = {
  current: undefined as
    | { title: string; body?: string; eventId?: string; startTime?: string; endTime?: string; notes?: string }
    | undefined,
};

const ALARM_WINDOW_DAYS = 30;

function dateKeyInDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export async function cancelEventReminder(eventId: string) {
  const map = loadReminderMap();
  const keyPrefix = `${eventId}:`;
  let changed = false;
  for (const key of Object.keys(map)) {
    if (key === eventId || key.startsWith(keyPrefix)) {
      try { await Notifications.cancelScheduledNotificationAsync(map[key]); } catch {}
      delete map[key];
      changed = true;
    }
  }
  if (changed) saveReminderMap(map);
  try { NativeAlarm?.cancelAlarms(eventId); } catch {}
}

function fireDateFor(occurrenceStart: Date, minutesBefore: number): Date {
  const fireDate = new Date(occurrenceStart);
  fireDate.setMinutes(fireDate.getMinutes() - minutesBefore);
  // If the reminder moment (or even the start) is already here/past when the
  // alarm is set, ring it shortly instead of silently dropping it. This covers
  // "I set a 15m reminder but the event is already <15m away (or just passed)".
  if (fireDate.getTime() <= Date.now()) {
    return new Date(Date.now() + 10 * 1000);
  }
  return fireDate;
}

async function scheduleOccurrenceAlarm({
  eventId,
  title,
  occurrence,
  occurrenceEnd,
  notes,
  minutesBefore,
}: {
  eventId: string;
  title: string;
  occurrence: Date;
  occurrenceEnd?: Date;
  notes?: string;
  minutesBefore: number;
}): Promise<void> {
  const fireDate = fireDateFor(occurrence, minutesBefore);
  if (fireDate.getTime() <= Date.now()) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await ensureAlarmChannel();

  const map = loadReminderMap();
  const key = `${eventId}:${occurrence.toISOString()}`;
  const prevId = map[key];
  if (prevId) {
    try { await Notifications.cancelScheduledNotificationAsync(prevId); } catch {}
  }
  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const timeRange = occurrenceEnd
    ? `${fmtTime(occurrence)} – ${fmtTime(occurrenceEnd)}`
    : fmtTime(occurrence);
  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body: notes ? `${timeRange}\n${notes}` : timeRange,
      sound: Platform.OS === "ios" ? "default" : undefined,
      data: {
        type: "event-alarm",
        eventId,
        startTime: occurrence.toISOString(),
        endTime: occurrenceEnd ? occurrenceEnd.toISOString() : undefined,
        notes: notes || undefined,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      channelId: Platform.OS === "android" ? "event-alarm" : undefined,
    },
  });
  map[key] = notifId;
  saveReminderMap(map);

  // Native full-screen ring for when the app is backgrounded / screen locked.
  try {
    NativeAlarm?.scheduleAlarm(
      key,
      title,
      timeRange,
      occurrence.getTime(),
      fireDate.getTime(),
      notifId,
      occurrenceEnd ? occurrenceEnd.getTime() : 0,
      notes || "",
    );
  } catch {}
}

/**
 * Schedule alarms for an event. Recurring events get one alarm per
 * occurrence over the next ALARM_WINDOW_DAYS days, so a repeating event
 * rings for every instance (the batch behavior).
 */
export async function scheduleEventReminder(event: CalendarEvent) {
  if (!event.reminder) return;

  const prev = loadReminderMap();
  const keyPrefix = `${event.id}:`;
  let changed = false;
  for (const key of Object.keys(prev)) {
    if (key.startsWith(keyPrefix)) {
      try { await Notifications.cancelScheduledNotificationAsync(prev[key]); } catch {}
      delete prev[key];
      changed = true;
    }
  }
  if (changed) saveReminderMap(prev);

  try { NativeAlarm?.cancelAlarms(event.id); } catch {}

  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  // Duration to project onto each occurrence's start (0 if unknown/invalid).
  const durationMs =
    !isNaN(end.getTime()) && !isNaN(start.getTime()) && end.getTime() > start.getTime()
      ? end.getTime() - start.getTime()
      : 0;
  const eventNotes = event.notes || event.description || "";
  // Look back a little so an event whose start (or reminder lead time) has just
  // passed still rings immediately, instead of being skipped.
  const from = dateKeyInDays(-1);
  const to = dateKeyInDays(ALARM_WINDOW_DAYS);
  let days = expandOccurrences(event, from, to, ALARM_WINDOW_DAYS * 2);

  // Non-recurring events always ring — even if the start already passed when
  // the alarm was (re)set — so a just-added past event fires right away.
  if (!event.recurrence && days.length === 0) {
    days = [eventStartDate(event)];
  }

  // Grace window: fire immediately for occurrences that started within the last
  // 6 hours; genuinely old occurrences (before that) are skipped.
  const GRACE_MS = 6 * 60 * 60 * 1000;

  for (const day of days) {
    const occurrence = new Date(`${day}T00:00:00`);
    occurrence.setHours(start.getHours(), start.getMinutes(), 0, 0);
    const isRecurring = !!event.recurrence;
    if (occurrence.getTime() <= Date.now()) {
      // Skip stale occurrences, but keep recent ones (and always a single
      // non-recurring event) so they fire immediately via fireDateFor.
      const tooOld = Date.now() - occurrence.getTime() > GRACE_MS;
      if (isRecurring && tooOld) continue;
    }
    const occurrenceEnd = durationMs > 0 ? new Date(occurrence.getTime() + durationMs) : undefined;
    try {
      await scheduleOccurrenceAlarm({
        eventId: event.id,
        title: event.title,
        occurrence,
        occurrenceEnd,
        notes: eventNotes,
        minutesBefore: event.reminder,
      });
    } catch {}
  }
}

/** Re-fire the last alarm after a snooze. */
export async function snoozeAlarm(minutes = 1): Promise<void> {
  const payload = lastAlarmPayload.current;
  if (!payload) return;
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await ensureAlarmChannel();
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

export async function scheduleTodoReminder(todo: { title: string; dueDate?: string; id: string }) {
  if (!todo.dueDate) return;
  const triggerDate = new Date(todo.dueDate);
  triggerDate.setHours(9, 0, 0, 0);

  if (triggerDate.getTime() > Date.now()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Todo Due Today",
        body: todo.title,
        data: { type: "todo-reminder", todoId: todo.id },
      },
      trigger: { date: triggerDate, type: Notifications.SchedulableTriggerInputTypes.DATE },
    });
  }
}

export async function scheduleTodayReminders() {
  const { useCalendarStore } = await import("@/stores/calendar-store");
  const { useTodoStore } = await import("@/stores/todo-store");
  const { occursOnDate, todayKey } = await import("@/utils/recurrence");

  const todayStr = todayKey();
  const events = useCalendarStore.getState().events;
  const todos = useTodoStore.getState().todos;

  const todayEvents = events.filter((e) => occursOnDate(e, todayStr) && !!e.reminder);
  const todayTodos = todos.filter(
    (t) => t.dueDate?.startsWith(todayStr) && !t.completed
  );

  let count = 0;
  for (const event of todayEvents) {
    try {
      await scheduleEventReminder(event);
      count++;
    } catch {}
  }
  for (const todo of todayTodos) {
    try {
      await scheduleTodoReminder(todo);
      count++;
    } catch {}
  }
  return count;
}

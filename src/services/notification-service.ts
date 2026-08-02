import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import NotificationListener from "expo-android-notification-listener-service";
import type { NotificationData } from "expo-android-notification-listener-service";
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { CalendarEvent } from "@/stores/calendar-store";
import { settingsStorage } from "@/stores/mmkv";

export type { NotificationData };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
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
        console.error("[notifications] init failed:", e);
      }
    })();

    // The app's own scheduled reminders (event/todo alarms) land in the Inbox
    // history when they fire while the app is in the foreground.
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
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

// One scheduled notification id per event, so re-running scheduleTodayReminders
// (e.g. on every app open) cancels the previous alarm instead of stacking
// duplicate alarms for the same event.
const REMINDER_MAP_KEY = "eventReminderNotifs";

function loadReminderMap(): Record<string, string> {
  const raw = settingsStorage.getString(REMINDER_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveReminderMap(map: Record<string, string>) {
  settingsStorage.set(REMINDER_MAP_KEY, JSON.stringify(map));
}

export async function cancelEventReminder(eventId: string) {
  const map = loadReminderMap();
  const prevId = map[eventId];
  if (prevId) {
    try { await Notifications.cancelScheduledNotificationAsync(prevId); } catch {}
    delete map[eventId];
    saveReminderMap(map);
  }
}

export async function scheduleEventReminder(event: { title: string; startDate: string; id: string; reminder?: number }) {
  if (!event.reminder) return;

  let fireDate = new Date(event.startDate);
  fireDate.setMinutes(fireDate.getMinutes() - event.reminder);

  // If the reminder moment is already here but the event hasn't happened yet
  // (e.g. "1 hour before" with the event exactly an hour away), still fire it
  // shortly rather than silently dropping it.
  if (fireDate.getTime() <= Date.now() && new Date(event.startDate).getTime() > Date.now()) {
    fireDate = new Date(Date.now() + 1000 * 10);
  }

  if (fireDate.getTime() > Date.now()) {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    await ensureAlarmChannel();

    const map = loadReminderMap();
    const prevId = map[event.id];
    if (prevId) {
      try { await Notifications.cancelScheduledNotificationAsync(prevId); } catch {}
    }
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Upcoming Event",
        body: event.title,
        sound: Platform.OS === "ios" ? "default" : undefined,
        data: { type: "event-reminder", eventId: event.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
        channelId: Platform.OS === "android" ? "event-alarm" : undefined,
      },
    });
    map[event.id] = notifId;
    saveReminderMap(map);
  }
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

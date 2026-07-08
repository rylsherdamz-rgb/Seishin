import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import NotificationListener from "expo-android-notification-listener-service";
import type { NotificationData } from "expo-android-notification-listener-service";
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { useCalendarStore, CalendarEvent } from "@/stores/calendar-store";
import { useSettingsStore } from "@/stores/settings-store";

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

export function useNotifications() {
  const { addItem } = useInboxStore();
  const { addEvent } = useCalendarStore();
  const { notificationFilter } = useSettingsStore();
  const listenerRef = useRef<any>(null);
  const responseListenerRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (Platform.OS !== "android") return;

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
      sub.remove();
      if (responseSub) responseSub.remove();
      subscription.remove();
    };
  }, [notificationFilter]);

  function handleNotificationData(data: NotificationData) {
    if (notificationFilter.length > 0 && !notificationFilter.includes(data.packageName)) return;

    const item: InboxItem = {
      id: `notif-${data.id}-${Date.now()}`,
      type: "notification",
      title: data.title || data.appName,
      body: data.text || data.bigText || "",
      timestamp: new Date(data.postTime).toISOString(),
      source: data.appName || data.packageName,
      read: false,
    };
    addItem(item);

    const parsed = parseNotificationForEvent(data);
    if (parsed) {
      addEvent(parsed);
    }
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

export async function scheduleEventReminder(event: { title: string; startDate: string; id: string }) {
  const triggerDate = new Date(event.startDate);
  triggerDate.setMinutes(triggerDate.getMinutes() - 15);

  if (triggerDate.getTime() > Date.now()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Upcoming Event",
        body: event.title,
        data: { type: "event-reminder", eventId: event.id },
      },
      trigger: { date: triggerDate, type: Notifications.SchedulableTriggerInputTypes.DATE },
    });
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

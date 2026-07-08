import { useEffect, useCallback, useRef } from "react";
import NotificationListener from "expo-android-notification-listener-service";
import type { NotificationData } from "expo-android-notification-listener-service";
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { useCalendarStore, CalendarEvent } from "@/stores/calendar-store";
import { useSettingsStore } from "@/stores/settings-store";

export type { NotificationData };

export function useNotificationListener() {
  const { addItem } = useInboxStore();
  const { addEvent } = useCalendarStore();
  const { notificationFilter } = useSettingsStore();
  const listenerRef = useRef<any>(null);

  useEffect(() => {
    const sub = NotificationListener.addListener(
      "onNotificationReceived",
      (data: NotificationData) => {
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
    );

    listenerRef.current = sub;
    return () => sub.remove();
  }, [notificationFilter]);

  const isGranted = useCallback(() => {
    return NotificationListener.isNotificationPermissionGranted();
  }, []);

  const openSettings = useCallback(() => {
    NotificationListener.openNotificationListenerSettings();
  }, []);

  const setFilter = useCallback((packages: string[]) => {
    NotificationListener.setAllowedPackages(packages);
  }, []);

  return { isGranted, openSettings, setFilter };
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

export function formatNotification(data: NotificationData): string {
  return `${data.appName}: ${data.title}${data.text ? " - " + data.text : ""}`;
}

import { settingsStorage } from "@/stores/mmkv";

jest.mock("expo-notifications", () => {
  let counter = 0;
  const schedule = jest.fn(async () => `notif-${counter++}`);
  const cancel = jest.fn(async () => {});
  return {
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    scheduleNotificationAsync: schedule,
    cancelScheduledNotificationAsync: cancel,
    setNotificationChannelAsync: jest.fn(async () => {}),
    SchedulableTriggerInputTypes: { DATE: "date" },
    AndroidImportance: { HIGH: 4 },
    __schedule: schedule,
    __cancel: cancel,
  };
});

jest.mock("expo-android-notification-listener-service", () => ({
  __esModule: true,
  default: {
    isNotificationPermissionGranted: jest.fn(() => true),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    openNotificationListenerSettings: jest.fn(),
  },
}));

import {
  scheduleEventReminder,
  cancelEventReminder,
} from "@/services/notification-service";
import * as Notifications from "expo-notifications";
import type { CalendarEvent } from "@/stores/calendar-store";

const schedule = (Notifications as unknown as { __schedule: jest.Mock }).__schedule;
const cancel = (Notifications as unknown as { __cancel: jest.Mock }).__cancel;

const REMINDER_MAP_KEY = "eventReminderNotifs";

const tomorrowAt = (h: number, m: number) => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

function baseEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "evt-1",
    title: "Standup",
    startDate: tomorrowAt(9, 30),
    endDate: tomorrowAt(10, 0),
    source: "manual",
    reminder: 30,
    ...overrides,
  };
}

beforeEach(() => {
  schedule.mockClear();
  cancel.mockClear();
  settingsStorage.clearAll();
});

describe("event alarm scheduling", () => {
  test("single event schedules one alarm keyed by event id + occurrence", async () => {
    await scheduleEventReminder(baseEvent({}));
    expect(schedule).toHaveBeenCalledTimes(1);
    const map = JSON.parse(settingsStorage.getString(REMINDER_MAP_KEY)!);
    const keys = Object.keys(map);
    expect(keys).toHaveLength(1);
    expect(keys[0].startsWith("evt-1:")).toBe(true);

    const call = schedule.mock.calls[0][0];
    expect(call.content.data.type).toBe("event-alarm");
    expect(call.content.title).toBe("Standup");
    expect(typeof call.content.data.startTime).toBe("string");
  });

  test("recurring event schedules one alarm per occurrence (batch)", async () => {
    const event = baseEvent({
      recurrence: { frequency: "daily", interval: 1 },
    });
    await scheduleEventReminder(event);
    const map = JSON.parse(settingsStorage.getString(REMINDER_MAP_KEY)!);
    const keys = Object.keys(map).filter((k) => k.startsWith("evt-1:"));
    expect(keys.length).toBeGreaterThan(1);
    // Each occurrence has its own stored notification id
    expect(new Set(keys.map((k) => map[k])).size).toBe(keys.length);
  });

  test("an event that ended long ago is not re-rung when edited", async () => {
    await scheduleEventReminder(baseEvent({ startDate: "2026-01-10T09:30:00.000Z", endDate: "2026-01-10T10:00:00.000Z" }));
    expect(schedule).not.toHaveBeenCalled();
  });

  test("re-scheduling replaces prior alarms for the same event", async () => {
    await scheduleEventReminder(baseEvent({}));
    const firstMap = JSON.parse(settingsStorage.getString(REMINDER_MAP_KEY)!);
    const firstIds = Object.values(firstMap) as string[];
    await scheduleEventReminder(baseEvent({}));
    // Map values are "notificationId|signature".
    expect(cancel).toHaveBeenCalledWith(firstIds[0].split("|")[0]);
  });

  test("cancelEventReminder clears all occurrences of the event", async () => {
    await scheduleEventReminder(baseEvent({ recurrence: { frequency: "daily", interval: 1 } }));
    const map = JSON.parse(settingsStorage.getString(REMINDER_MAP_KEY)!);
    const ids = Object.values(map);
    expect(ids.length).toBeGreaterThan(1);
    await cancelEventReminder("evt-1");
    expect(cancel).toHaveBeenCalledTimes(ids.length);
    const after = JSON.parse(settingsStorage.getString(REMINDER_MAP_KEY)!);
    expect(Object.keys(after).filter((k) => k.startsWith("evt-1"))).toHaveLength(0);
  });
});
jest.mock("expo-mlkit-ocr", () => ({ recognizeText: jest.fn() }));
const mockCancelAll = jest.fn(async () => {});
jest.mock("expo-notifications", () => ({
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));
jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
jest.mock("@/services/background-sync", () => ({ BACKGROUND_SYNC_TASK: "t" }));
const mockUnregister = jest.fn(async () => {});
jest.mock("expo-background-task", () => ({ unregisterTaskAsync: (...a: unknown[]) => mockUnregister(...(a as [])) }));

import { factoryReset } from "@/services/factory-reset";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useNotesStore } from "@/stores/notes-store";
import { eventsStorage } from "@/stores/mmkv";
import { getToken, setToken } from "@/services/connectors/secrets";

describe("factoryReset", () => {
  it("clears storage, in-memory stores, secrets, reminders and background sync", async () => {
    useCalendarStore.getState().addEvent({ id: "e1", title: "x", startDate: "2026-10-20T09:00:00Z", endDate: "2026-10-20T10:00:00Z", source: "manual" });
    useTodoStore.getState().addTodo({ id: "t1", title: "y", completed: false, priority: "medium", category: "", tags: [], createdAt: "" });
    useNotesStore.setState({ notes: [{ id: "n", title: "z", body: "", tags: [], pinned: false, attachments: [], createdAt: "", updatedAt: "" }] });
    await setToken("todoist", "secret-token");

    const res = await factoryReset();

    expect(res).toEqual({ ok: true, failed: [] });
    expect(useCalendarStore.getState().events).toEqual([]);
    expect(useTodoStore.getState().todos).toEqual([]);
    expect(useNotesStore.getState().notes).toEqual([]);
    expect(eventsStorage.getString("events")).toBeNull();
    expect(await getToken("todoist")).toBeNull();
    expect(mockCancelAll).toHaveBeenCalled();
    expect(mockUnregister).toHaveBeenCalledWith("t");
    // Stores still work after reset (actions survived the state replace).
    expect(useTodoStore.getState().addTodo({ id: "t2", title: "after", completed: false, priority: "low", category: "", tags: [], createdAt: "" })).toBe(true);
  });
});

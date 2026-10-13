jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
jest.mock("@/services/task-reminders", () => ({ scheduleTaskReminders: jest.fn(async () => 0), cancelTaskReminders: jest.fn(async () => {}) }));

import { useTodoStore } from "@/stores/todo-store";
import { useCalendarStore } from "@/stores/calendar-store";

// Auto-sync reloads both stores every minute and treats a new array as a user
// edit; an unchanged reload must keep the same array or sync loops forever.
describe("store reloads", () => {
  beforeEach(() => {
    useTodoStore.getState().clearAll();
    useCalendarStore.getState().clearAll();
  });

  it("loadTodos keeps the same array when storage is unchanged", () => {
    useTodoStore.getState().addTodo({ id: "t1", title: "Read", completed: false, priority: "medium", category: "general", tags: [], createdAt: new Date().toISOString() });
    const before = useTodoStore.getState().todos;
    useTodoStore.getState().loadTodos();
    expect(useTodoStore.getState().todos).toBe(before);
  });

  it("loadEvents keeps the same array when storage is unchanged", () => {
    const start = new Date();
    useCalendarStore.getState().addEvent({ id: "e1", title: "Gym", startDate: start.toISOString(), endDate: new Date(start.getTime() + 3600000).toISOString(), source: "manual" });
    const before = useCalendarStore.getState().events;
    useCalendarStore.getState().loadEvents();
    expect(useCalendarStore.getState().events).toBe(before);
  });
});

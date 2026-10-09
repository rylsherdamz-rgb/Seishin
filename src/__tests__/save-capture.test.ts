jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
const mockSchedule = jest.fn(async () => 0);
jest.mock("@/services/task-reminders", () => ({ scheduleTaskReminders: (...a: unknown[]) => mockSchedule(...a), cancelTaskReminders: jest.fn(async () => {}) }));

import { saveCapture } from "@/components/capture/save-capture";
import { useTodoStore } from "@/stores/todo-store";
import { useNotesStore } from "@/stores/notes-store";
import { useCalendarStore } from "@/stores/calendar-store";

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  useTodoStore.getState().clearAll();
  useCalendarStore.getState().clearAll();
  useNotesStore.setState({ notes: [] });
  mockSchedule.mockClear();
});

const due = new Date(Date.now() + 5 * 86400000);

describe("saveCapture", () => {
  it("assignment → pinned note with photos + task with checklist and persistent reminders", async () => {
    const { todoId, noteId } = saveCapture(
      { kind: "assignment", title: "Forces activity", subject: "Science", due, dueHasTime: false, items: ["Q1", "Q2"], reminder: "persistent" },
      [{ uri: "file:///a.jpg", mimeType: "image/jpeg" }, { uri: "file:///b.pdf", mimeType: "application/pdf", name: "b.pdf" }],
      "scanned words",
    );
    const todo = useTodoStore.getState().todos.find((t) => t.id === todoId)!;
    expect(todo.items?.map((i) => i.text)).toEqual(["Q1", "Q2"]);
    expect(todo.reminder).toBe("persistent");
    expect(todo.noteId).toBe(noteId);
    // Day-only due date is stored as 23:59 that day.
    expect(new Date(todo.dueDate!).getHours()).toBe(23);

    const note = useNotesStore.getState().notes.find((n) => n.id === noteId)!;
    expect(note.pinned).toBe(true);
    expect(note.attachments.map((a) => a.type)).toEqual(["image", "file"]);
    expect(note.body).toContain("1. Q1");
    expect(note.body).toContain("scanned words");

    await flush();
    expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({ id: todoId }));
    expect(useCalendarStore.getState().events).toHaveLength(0);
  });

  it("exam with a time also lands on the calendar", () => {
    saveCapture({ kind: "exam", title: "Bio quiz", subject: "", due, dueHasTime: true, items: [], reminder: "normal" }, [], "");
    const ev = useCalendarStore.getState().events;
    expect(ev).toHaveLength(1);
    expect(ev[0].title).toBe("Bio quiz");
    expect(useTodoStore.getState().todos[0].priority).toBe("high");
  });

  it("reading material with no date and no reminders is saved as a note only", () => {
    const { todoId } = saveCapture({ kind: "reading", title: "Chapter 4", subject: "", due: null, dueHasTime: false, items: [], reminder: "off" }, [], "text");
    expect(todoId).toBeNull();
    expect(useTodoStore.getState().todos).toHaveLength(0);
    expect(useNotesStore.getState().notes).toHaveLength(1);
  });
});

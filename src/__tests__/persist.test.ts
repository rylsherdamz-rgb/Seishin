import { readList, writeJSON, sizeOf, type KeyValueStore } from "@/stores/persist";
import { isTodo } from "@/stores/todo-store";

function memoryStore(init: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(init));
  return {
    data,
    getString: (k) => data.get(k),
    set: (k, v) => { data.set(k, v); },
    remove: (k) => data.delete(k),
  };
}

const isNum = (x: unknown): x is number => typeof x === "number";

describe("persist helpers", () => {
  it("returns [] for missing, corrupt or non-list data", () => {
    expect(readList(memoryStore(), "k", isNum)).toEqual([]);
    expect(readList(memoryStore({ k: "{not json" }), "k", isNum)).toEqual([]);
    expect(readList(memoryStore({ k: '{"a":1}' }), "k", isNum)).toEqual([]);
  });

  it("drops malformed records but keeps valid ones", () => {
    expect(readList(memoryStore({ k: '[1,"x",2,null]' }), "k", isNum)).toEqual([1, 2]);
  });

  it("reports write failures instead of throwing", () => {
    const store = memoryStore();
    store.set = () => { throw new Error("disk full"); };
    expect(writeJSON(store, "k", [1])).toBe(false);
  });

  it("round-trips and measures size", () => {
    const store = memoryStore();
    expect(writeJSON(store, "k", [1, 2])).toBe(true);
    expect(readList(store, "k", isNum)).toEqual([1, 2]);
    expect(sizeOf(store, "k")).toBe(5);
  });
});

describe("isTodo", () => {
  it("rejects records without id/title and repairs optional fields", () => {
    expect(isTodo({ title: "x" })).toBe(false);
    expect(isTodo(null)).toBe(false);
    const legacy: Record<string, unknown> = { id: "t1", title: "Old task", priority: "urgent" };
    expect(isTodo(legacy)).toBe(true);
    expect(legacy).toMatchObject({ completed: false, priority: "medium", category: "general", tags: [] });
  });
});

jest.mock("@/services/notification-service", () => ({
  scheduleEventReminder: jest.fn(() => Promise.resolve()),
  cancelEventReminder: jest.fn(),
}));

describe("calendar store validation", () => {
  // Required lazily so the notification-service mock above applies.
  const { useCalendarStore, isCalendarEvent } = require("@/stores/calendar-store");
  const valid = { id: "e1", title: "Standup", startDate: "2026-10-07T09:00:00.000Z", endDate: "2026-10-07T09:15:00.000Z", source: "manual" };

  it("accepts well-formed events and rejects bad dates or sources", () => {
    expect(isCalendarEvent(valid)).toBe(true);
    expect(isCalendarEvent({ ...valid, startDate: "next tuesday" })).toBe(false);
    expect(isCalendarEvent({ ...valid, source: "spam" })).toBe(false);
  });

  it("refuses to store an invalid event and keeps state unchanged", () => {
    useCalendarStore.getState().clearAll();
    expect(useCalendarStore.getState().addEvent({ ...valid, endDate: "nope" })).toBe(false);
    expect(useCalendarStore.getState().events).toHaveLength(0);
    expect(useCalendarStore.getState().addEvent(valid)).toBe(true);
    expect(useCalendarStore.getState().updateEvent("e1", { startDate: "bad" })).toBe(false);
    expect(useCalendarStore.getState().events[0].startDate).toBe(valid.startDate);
  });
});

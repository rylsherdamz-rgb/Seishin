import { planImport, planExport, eventHash, importId, taskDeadlineEvents, toDeviceRecurrence, type RemoteEvent } from "@/services/calendar-sync-plan";
import type { CalendarEvent } from "@/stores/calendar-store";

const WINDOW = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-12-31T00:00:00Z") };
const r = (id: string, cal = "google", start = "2026-10-10T09:00:00Z"): RemoteEvent => ({
  id, calendarId: cal, title: `Remote ${id}`, startDate: start, endDate: "2026-10-10T10:00:00Z", allDay: false,
});
const local = (id: string, source: CalendarEvent["source"] = "manual"): CalendarEvent => ({
  id, title: `Local ${id}`, startDate: "2026-10-11T09:00:00.000Z", endDate: "2026-10-11T10:00:00.000Z", source,
});

describe("planImport", () => {
  it("adds new remote events from selected calendars only", () => {
    const plan = planImport([r("a"), r("b", "work")], [], ["google"], WINDOW);
    expect(plan.upserts.map((e) => e.title)).toEqual(["Remote a"]);
    expect(plan.upserts[0].source).toBe("calendar");
  });

  it("is a no-op when nothing changed, updates when it did", () => {
    const first = planImport([r("a")], [], ["google"], WINDOW).upserts;
    expect(planImport([r("a")], first, ["google"], WINDOW)).toEqual({ upserts: [], removeIds: [] });
    const changed = { ...r("a"), title: "Renamed" };
    expect(planImport([changed], first, ["google"], WINDOW).upserts[0].title).toBe("Renamed");
  });

  it("removes imported events deleted remotely or from deselected calendars, never Seishin's own", () => {
    const imported = planImport([r("a"), r("b")], [], ["google"], WINDOW).upserts;
    const mine = local("mine");
    const plan = planImport([r("a")], [...imported, mine], ["google"], WINDOW);
    expect(plan.removeIds).toEqual([importId(r("b"))]);
    expect(planImport([], [...imported, mine], [], WINDOW).removeIds.sort()).toEqual(imported.map((e) => e.id).sort());
  });

  it("keeps imported events outside the synced window", () => {
    const old = planImport([r("old", "google", "2026-01-05T09:00:00Z")], [], ["google"], { from: new Date("2026-01-01"), to: new Date("2026-02-01") }).upserts;
    expect(planImport([], old, ["google"], WINDOW).removeIds).toEqual([]);
  });
});

describe("planExport", () => {
  it("creates, updates and deletes by hash, and never exports imported events", () => {
    const a = local("a");
    const b = local("b");
    const imported = local("x", "calendar");
    const records = {
      b: { deviceId: "dev-b", hash: "stale" },
      gone: { deviceId: "dev-gone", hash: "h" },
    };
    const plan = planExport([a, b, imported], records);
    expect(plan.create.map((e) => e.id)).toEqual(["a"]);
    expect(plan.update).toEqual([{ event: b, deviceId: "dev-b" }]);
    expect(plan.remove).toEqual([{ localId: "gone", deviceId: "dev-gone" }]);
    expect(planExport([b], { b: { deviceId: "dev-b", hash: eventHash(b) } })).toEqual({ create: [], update: [], remove: [] });
  });
});

describe("task deadlines and recurrence", () => {
  it("turns open tasks into deadline blocks; end-of-day deadlines become all-day", () => {
    const events = taskDeadlineEvents([
      { id: "t1", title: "Essay", completed: false, dueDate: new Date(2026, 9, 15, 17, 0).toISOString(), priority: "high", category: "x", tags: [], createdAt: "" },
      { id: "t2", title: "Read", completed: false, dueDate: new Date(2026, 9, 16, 23, 59).toISOString(), priority: "low", category: "x", tags: [], createdAt: "" },
      { id: "t3", title: "Done", completed: true, dueDate: new Date(2026, 9, 16).toISOString(), priority: "low", category: "x", tags: [], createdAt: "" },
    ]);
    expect(events.map((e) => e.title)).toEqual(["Due: Essay", "Due: Read"]);
    expect(Date.parse(events[0].endDate) - Date.parse(events[0].startDate)).toBe(30 * 60000);
    expect(events[1].allDay).toBe(true);
  });

  it("maps weekdays to the device's 1 = Sunday numbering", () => {
    expect(toDeviceRecurrence({ frequency: "weekly", weekdays: [1, 3] })?.daysOfTheWeek).toEqual([{ dayOfTheWeek: 2 }, { dayOfTheWeek: 4 }]);
    expect(toDeviceRecurrence(undefined)).toBeNull();
  });
});

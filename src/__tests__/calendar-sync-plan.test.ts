import { planImport, planExport, eventHash, importId, taskDeadlineEvents, toDeviceRecurrence, groupCalendarsByAccount, chosenAccounts, setAccountChosen, type RemoteEvent } from "@/services/calendar-sync-plan";
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

describe("device quirks", () => {
  const { allDayFromUtc, allDayToUtc, remoteToLocal } = jest.requireActual("@/services/calendar-sync-plan") as typeof import("@/services/calendar-sync-plan");
  const { occursOnDate } = jest.requireActual("@/utils/recurrence") as typeof import("@/utils/recurrence");

  it("Android all-day events (UTC midnight) land on their local day", () => {
    const span = allDayFromUtc("2026-10-15T00:00:00.000Z", "2026-10-16T00:00:00.000Z");
    const ev = { id: "x", title: "Holiday", ...span, allDay: true, source: "calendar" as const };
    expect(occursOnDate(ev, "2026-10-15")).toBe(true);
    expect(occursOnDate(ev, "2026-10-14")).toBe(false);
    expect(occursOnDate(ev, "2026-10-16")).toBe(false);
  });

  it("multi-day all-day events cover every day", () => {
    const span = allDayFromUtc("2026-10-15T00:00:00.000Z", "2026-10-18T00:00:00.000Z");
    const ev = { id: "x", title: "Trip", ...span, allDay: true, source: "calendar" as const };
    expect(["2026-10-15", "2026-10-16", "2026-10-17"].every((d) => occursOnDate(ev, d))).toBe(true);
    expect(occursOnDate(ev, "2026-10-18")).toBe(false);
  });

  it("exports all-day events as UTC midnight, end exclusive", () => {
    const { start, end } = allDayToUtc(new Date(2026, 9, 15).toISOString(), new Date(2026, 9, 15, 23, 59).toISOString());
    expect(start.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });

  it("keeps the event's own reminder, else the default", () => {
    const base = { id: "1", calendarId: "g", title: "A", startDate: "2026-10-15T01:00:00Z", endDate: "2026-10-15T02:00:00Z", allDay: false };
    expect(remoteToLocal({ ...base, alarmMinutes: 30 }, { defaultReminder: 10 }).reminder).toBe(30);
    expect(remoteToLocal({ ...base, alarmMinutes: null }, { defaultReminder: 10 }).reminder).toBe(10);
    expect(remoteToLocal({ ...base }, { defaultReminder: 0 }).reminder).toBeUndefined();
  });
});

describe("groupCalendarsByAccount", () => {
  const cal = (id: string, account: string, synced = true) => ({ id, account, synced });

  it("groups by account in input order and drops unsynced calendars", () => {
    const groups = groupCalendarsByAccount([
      cal("1", "b@gmail.com"),
      cal("2", "a@gmail.com"),
      cal("3", "b@gmail.com"),
      cal("4", "a@gmail.com", false),
      cal("5", "c@gmail.com", false),
    ]);
    expect(groups.map((g) => g.account)).toEqual(["b@gmail.com", "a@gmail.com"]);
    expect(groups[0].calendars.map((c) => c.id)).toEqual(["1", "3"]);
    expect(groups[1].calendars.map((c) => c.id)).toEqual(["2"]);
  });
});

describe("account picking", () => {
  const cals = [
    { id: "a1", account: "a@gmail.com", synced: true, writable: true, primary: true },
    { id: "a2", account: "a@gmail.com", synced: true, writable: false, primary: false },
    { id: "a3", account: "a@gmail.com", synced: false, writable: true, primary: false },
    { id: "b1", account: "b@gmail.com", synced: true, writable: true, primary: true },
  ];
  const none = { accounts: [], importIds: [], exportId: null };

  it("first pick shows the account's synced calendars and saves to its primary", () => {
    expect(setAccountChosen(none, cals, "a@gmail.com", true)).toEqual({ accounts: ["a@gmail.com"], importIds: ["a1", "a2"], exportId: "a1" });
  });

  it("later picks keep the existing save target", () => {
    const a = setAccountChosen(none, cals, "a@gmail.com", true);
    expect(setAccountChosen(a, cals, "b@gmail.com", true)).toEqual({ accounts: ["a@gmail.com", "b@gmail.com"], importIds: ["a1", "a2", "b1"], exportId: "a1" });
  });

  it("removing an account hides its calendars and clears a save target inside it", () => {
    const both = { accounts: ["a@gmail.com", "b@gmail.com"], importIds: ["a1", "b1"], exportId: "a1" };
    expect(setAccountChosen(both, cals, "a@gmail.com", false)).toEqual({ accounts: ["b@gmail.com"], importIds: ["b1"], exportId: null });
    expect(setAccountChosen(both, cals, "b@gmail.com", false).exportId).toBe("a1");
  });

  it("older installs derive accounts from shown calendars", () => {
    expect(chosenAccounts(undefined, ["b1"], cals)).toEqual(["b@gmail.com"]);
    expect(chosenAccounts([], ["b1"], cals)).toEqual([]);
  });
});

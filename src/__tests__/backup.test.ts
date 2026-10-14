jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
import { buildBackup, parseBackup, mergeById, noteIsNewer, countBackup } from "@/services/backup";
import type { CalendarEvent } from "@/stores/calendar-store";
import type { Note } from "@/stores/notes-store";

const ev = (id: string, source: CalendarEvent["source"] = "manual"): CalendarEvent => ({ id, title: id, startDate: "2026-10-20T09:00:00.000Z", endDate: "2026-10-20T10:00:00.000Z", source });
const note = (id: string, updatedAt: string): Note => ({ id, title: id, body: "", tags: [], pinned: false, attachments: [], createdAt: updatedAt, updatedAt });

describe("backup round-trip", () => {
  it("keeps own data and portable prefs, drops synced copies and secrets", () => {
    const b = buildBackup(
      [ev("mine"), ev("google", "calendar"), ev("canvas", "feed")],
      [{ id: "t", title: "Task", completed: false, priority: "medium", category: "", tags: [], createdAt: "" }],
      [note("n", "2026-10-01T00:00:00.000Z")],
      { "settings:theme:mode": "dark", apiKeys: '{"nim":"secret"}', "settings:connectors:notion": "{}" },
    );
    expect(b.events.map((e) => e.id)).toEqual(["mine"]);
    expect(b.prefs).toEqual({ "settings:theme:mode": "dark" });
    const parsed = parseBackup(JSON.stringify(b));
    expect(countBackup(parsed)).toEqual({ events: 1, todos: 1, notes: 1 });
  });

  it("drops malformed records instead of failing the whole restore", () => {
    const parsed = parseBackup(JSON.stringify({ app: "seishin", version: 1, events: [ev("ok"), { id: "bad", startDate: "nope" }], todos: [{ nope: 1 }], notes: [{ id: "n", title: "t", body: "b" }], prefs: { apiKeys: "x" } }));
    expect(parsed.events.map((e) => e.id)).toEqual(["ok"]);
    expect(parsed.todos).toEqual([]);
    expect(parsed.notes[0]).toMatchObject({ id: "n", tags: [], attachments: [], pinned: false });
    expect(parsed.prefs).toEqual({});
  });

  it("rejects non-backups and newer formats with readable messages", () => {
    expect(() => parseBackup("not json")).toThrow(/not valid JSON/);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/isn't a Seishin backup/);
    expect(() => parseBackup('{"app":"seishin","version":99}')).toThrow(/newer version/);
  });
});

describe("mergeById", () => {
  it("unions by id; phone copy wins unless the newer() rule says otherwise", () => {
    expect(mergeById([ev("a")], [{ ...ev("a"), title: "from backup" }, ev("b")]).map((e) => e.title)).toEqual(["a", "b"]);
    const merged = mergeById([note("n", "2026-10-01"), note("m", "2026-10-05")], [note("n", "2026-10-03"), note("m", "2026-10-02")], noteIsNewer);
    expect(merged.map((n) => n.updatedAt)).toEqual(["2026-10-03", "2026-10-05"]);
  });
});

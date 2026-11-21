jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
import { restoreBackup } from "@/services/backup-io";
import { scheduleEventReminder } from "@/services/notification-service";
import type { CalendarEvent } from "@/stores/calendar-store";
import { buildBackup } from "@/services/backup";
import { notesStorage } from "@/stores/mmkv";
import { useNotesStore, type Note } from "@/stores/notes-store";

const note = (id: string): Note => ({ id, title: id, body: "", tags: [], pinned: false, attachments: [], createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" });

describe("restoreBackup", () => {
  it("merges with notes on disk even when the Notes tab was never opened", () => {
    notesStorage.set("notes", JSON.stringify([note("on-phone")]));
    expect(useNotesStore.getState().notes).toEqual([]); // not loaded yet

    restoreBackup(buildBackup([], [], [note("from-backup")], {}), "merge");

    const ids = useNotesStore.getState().notes.map((n) => n.id).sort();
    expect(ids).toEqual(["from-backup", "on-phone"]);
    expect(JSON.parse(notesStorage.getString("notes")!).map((n: Note) => n.id).sort()).toEqual(["from-backup", "on-phone"]);
  });

  it("re-arms restored alarms without catch-up rings for events earlier today", () => {
    const ev: CalendarEvent = { id: "e1", title: "Gym", startDate: new Date(Date.now() - 600000).toISOString(), endDate: new Date().toISOString(), source: "manual", reminder: 15 };
    restoreBackup(buildBackup([ev], [], [], {}), "replace");
    expect(scheduleEventReminder).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }), expect.any(Date), { catchUp: false });
  });
});

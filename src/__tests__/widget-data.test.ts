import { agendaFor, tasksFor, monthGrid, nextUp, fmtTime } from "@/widgets/widget-data";
import type { CalendarEvent } from "@/stores/calendar-store";
import type { Todo } from "@/stores/todo-store";

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const NOW = at(2026, 10, 14, 12); // Wednesday
const ev = (id: string, s: Date, e: Date, o: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title: id, startDate: s.toISOString(), endDate: e.toISOString(), source: "manual", ...o });
const todo = (id: string, due?: Date, o: Partial<Todo> = {}): Todo => ({ id, title: id, completed: false, priority: "medium", createdAt: "2026-10-01T00:00:00Z", dueDate: due?.toISOString(), ...o } as Todo);

describe("widget data", () => {
  it("agenda: today's remaining events + overdue tasks, then tomorrow", () => {
    const days = agendaFor(
      [
        ev("Done already", at(2026, 10, 14, 8), at(2026, 10, 14, 9)),
        ev("Lab", at(2026, 10, 14, 15), at(2026, 10, 14, 17)),
        ev("Early class", at(2026, 10, 15, 7), at(2026, 10, 15, 8)),
      ],
      [todo("Essay", at(2026, 10, 13, 23, 59)), todo("Quiz", at(2026, 10, 15, 10), { items: [{ id: "a", text: "q1", done: true }, { id: "b", text: "q2", done: false }] })],
      NOW,
    );
    expect(days[0].label).toBe("Today");
    expect(days[0].rows.map((r) => r.title)).toEqual(["Essay", "Lab"]);
    expect(days[0].rows[0].when).toBe("Overdue · Tue, Oct 13");
    expect(days[1].label).toBe("Tomorrow");
    // 07:00 local stays on its local day in every time zone.
    expect(days[1].rows.map((r) => r.title)).toEqual(["Early class", "Quiz"]);
    expect(days[1].rows[1].progress).toBe("1/2");
  });

  it("an end-of-day deadline tomorrow doesn't say 'Due today'", () => {
    const [today, tomorrow] = agendaFor([], [todo("Today's", at(2026, 10, 14, 23, 59)), todo("Tomorrow's", at(2026, 10, 15, 23, 59))], NOW);
    expect(today.rows[0].when).toBe("Due today");
    expect(tomorrow.rows[0].when).toBe("Due end of day");
  });

  it("tasks: overdue first, undated last, completed hidden", () => {
    const rows = tasksFor([todo("Undated"), todo("Later", at(2026, 10, 20, 9)), todo("Late", at(2026, 10, 12, 9)), todo("Done", at(2026, 10, 10), { completed: true })], NOW);
    expect(rows.map((r) => r.title)).toEqual(["Late", "Later", "Undated"]);
    expect(rows[0].overdue).toBe(true);
    expect(rows[1].when).toBe("Tue, Oct 20 · 9:00 AM");
  });

  it("month grid starts on Sunday, marks today and counts", () => {
    const weeks = monthGrid(2026, 9, [ev("x", at(2026, 10, 14, 9), at(2026, 10, 14, 10))], [todo("t", at(2026, 10, 14, 17))], NOW);
    const cells = weeks.flat();
    expect(cells[0].key).toBe("2026-09-27");
    const today = cells.find((c) => c.today)!;
    expect(today.key).toBe("2026-10-14");
    expect(today.count).toBe(2);
    expect(weeks.length).toBe(5);
  });

  it("next up: ongoing event beats a later deadline; falls back to a deadline", () => {
    const n = nextUp([ev("Meeting", at(2026, 10, 14, 11, 30), at(2026, 10, 14, 13))], [todo("Report", at(2026, 10, 14, 17))], NOW)!;
    expect(n.title).toBe("Meeting");
    expect(n.when).toBe("Now · until 1:00 PM");
    const d = nextUp([], [todo("Report", at(2026, 10, 14, 12, 40))], NOW)!;
    expect(d.when).toBe("Due in 40 min");
    expect(nextUp([], [], NOW)).toBeNull();
  });

  it("formats 12-hour times", () => {
    expect(fmtTime(at(2026, 1, 1, 0, 5))).toBe("12:05 AM");
    expect(fmtTime(at(2026, 1, 1, 13, 0))).toBe("1:00 PM");
  });
});

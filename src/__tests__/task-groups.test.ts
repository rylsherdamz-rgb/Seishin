import { groupTasks, quickDue, quickDueOf, type TaskListRow } from "@/utils/task-groups";
import type { Todo } from "@/stores/todo-store";

const NOW = new Date(2026, 9, 22, 12, 0); // Thu Oct 22, noon
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).toISOString();
const todo = (id: string, due?: string, extra: Partial<Todo> = {}): Todo => ({
  id, title: id, dueDate: due, completed: false, priority: "medium", category: "general", tags: [], createdAt: at(20, 9), ...extra,
});
const opts = { showCompleted: false, timeFormat: "12h" as const };
const shape = (rows: TaskListRow[]) => rows.map((r) => (r.kind === "header" ? `# ${r.label} ${r.count}` : `${r.id}${r.due ? ` (${r.due})` : ""}${r.overdue ? " !" : ""}`));

describe("groupTasks", () => {
  it("splits open tasks into overdue, today, upcoming and no date, in due order", () => {
    const rows = groupTasks([
      todo("later", at(25, 9)),
      todo("none"),
      todo("tonight", at(22, 23, 59)),
      todo("missed", at(21, 23, 59)),
      todo("thisMorning", at(22, 9)),
      todo("afternoon", at(22, 15)),
      todo("tomorrow", at(23, 10, 30)),
    ], NOW, opts);
    expect(shape(rows)).toEqual([
      "# Overdue 2",
      "missed (Wed, Oct 21) !",
      "thisMorning (Today · 9:00 AM) !",
      "# Today 2",
      "afternoon (3:00 PM)",
      "tonight (Due today)",
      "# Upcoming 2",
      "tomorrow (Tomorrow · 10:30 AM)",
      "later (Sun, Oct 25 · 9:00 AM)",
      "# No date 1",
      "none",
    ]);
  });

  it("counts completed tasks but only lists them when expanded", () => {
    const list = [todo("a"), todo("b", undefined, { completed: true, completedAt: at(21, 8) }), todo("c", undefined, { completed: true, completedAt: at(22, 8) })];
    expect(shape(groupTasks(list, NOW, opts))).toEqual(["# No date 1", "a", "# Completed 2"]);
    expect(shape(groupTasks(list, NOW, { ...opts, showCompleted: true }))).toEqual(["# No date 1", "a", "# Completed 2", "c", "b"]);
  });

  it("reports checklist progress", () => {
    const rows = groupTasks([todo("essay", undefined, { items: [{ id: "1", text: "x", done: true }, { id: "2", text: "y", done: false }] })], NOW, opts);
    expect(rows[1]).toMatchObject({ kind: "task", progress: "1/2" });
  });
});

describe("quickDue", () => {
  it("returns the chosen day at 23:59, across month ends", () => {
    const end = new Date(2026, 9, 31, 8);
    expect(quickDue("today", end)).toEqual(new Date(2026, 9, 31, 23, 59));
    expect(quickDue("tomorrow", end)).toEqual(new Date(2026, 10, 1, 23, 59));
    expect(quickDue("nextweek", end)).toEqual(new Date(2026, 10, 7, 23, 59));
  });

  it("maps a due date back to its chip, or null for other days", () => {
    expect(quickDueOf(null, NOW)).toBeNull();
    expect(quickDueOf(new Date(2026, 9, 23, 9), NOW)).toBe("tomorrow");
    expect(quickDueOf(new Date(2026, 9, 29, 23, 59), NOW)).toBe("nextweek");
    expect(quickDueOf(new Date(2026, 9, 26), NOW)).toBeNull();
  });
});

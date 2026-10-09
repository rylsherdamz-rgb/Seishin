import { planTaskSync, normalizeDue, externalTodoId, type ExternalTask } from "@/services/connectors/task-sync-plan";
import type { Todo } from "@/stores/todo-store";

const ext = (id: string, over: Partial<ExternalTask> = {}): ExternalTask => ({ externalId: id, title: `Task ${id}`, done: false, ...over });
const todo = (id: string, over: Partial<Todo> = {}): Todo => ({
  id: externalTodoId("todoist", id), title: `Task ${id}`, completed: false, priority: "medium", category: "todoist",
  tags: [], createdAt: "", external: { provider: "todoist", id }, ...over,
});
const OPTS = { reminder: "persistent" as const, canCompleteRemote: true };

describe("planTaskSync", () => {
  it("creates open remote tasks with reminders only when they have a due date", () => {
    const plan = planTaskSync([ext("1", { due: "2026-10-15T15:00:00.000Z" }), ext("2"), ext("3", { done: true })], [], "todoist", OPTS);
    expect(plan.create.map((t) => [t.title, t.reminder])).toEqual([["Task 1", "persistent"], ["Task 2", "off"]]);
    expect(plan.create[0].external).toEqual({ provider: "todoist", id: "1", url: undefined });
  });

  it("syncs completion both ways; Seishin completion wins and is pushed upstream", () => {
    const local = [todo("a", { completed: true }), todo("b")];
    const plan = planTaskSync([ext("a"), ext("b", { done: true })], local, "todoist", OPTS);
    expect(plan.completeRemote).toEqual(["a"]);
    expect(plan.completeLocal).toEqual([todo("b").id]);
  });

  it("doesn't push completion to read-only sources", () => {
    const plan = planTaskSync([ext("a")], [todo("a", { completed: true })], "todoist", { ...OPTS, canCompleteRemote: false });
    expect(plan.completeRemote).toEqual([]);
  });

  it("completes (never deletes) tasks that vanished upstream, and ignores other providers", () => {
    const other: Todo = { ...todo("z"), id: "notion-z", external: { provider: "notion", id: "z" } };
    const plan = planTaskSync([], [todo("gone"), todo("old", { completed: true }), other], "todoist", OPTS);
    expect(plan.completeLocal).toEqual([todo("gone").id]);
    expect(plan.create).toEqual([]);
  });

  it("updates changed titles and due dates only", () => {
    const local = [todo("a", { dueDate: "2026-10-15T15:00:00.000Z" })];
    expect(planTaskSync([ext("a", { due: "2026-10-15T15:00:00.000Z" })], local, "todoist", OPTS).update).toEqual([]);
    const plan = planTaskSync([ext("a", { title: "Renamed", due: "2026-10-16T15:00:00.000Z" })], local, "todoist", OPTS);
    expect(plan.update).toEqual([{ id: todo("a").id, changes: { title: "Renamed", dueDate: "2026-10-16T15:00:00.000Z" } }]);
  });
});

describe("normalizeDue", () => {
  it("day-only → 23:59 local, datetime passes through, junk → undefined", () => {
    const d = new Date(normalizeDue("2026-10-15")!);
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([15, 23, 59]);
    expect(normalizeDue(null, "2026-10-15T09:00:00Z")).toBe("2026-10-15T09:00:00.000Z");
    expect(normalizeDue("someday")).toBeUndefined();
  });
});

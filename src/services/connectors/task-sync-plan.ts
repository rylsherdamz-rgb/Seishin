/**
 * Pure reconciliation between an external task list (Todoist, Notion, a
 * course-calendar feed's deadlines…) and Seishin tasks. Unit-tested.
 *
 * Rules:
 *  - New open remote tasks become Seishin tasks (with the chosen reminders).
 *  - Title / due changes upstream update the Seishin copy.
 *  - Completion syncs both ways; completing in Seishin wins over "still open"
 *    upstream (pushed back when the service allows it).
 *  - A task that vanished upstream (completed or deleted there) is completed
 *    locally — never deleted — so history stays and reminders stop.
 */
import type { Todo } from "@/stores/todo-store";
import type { ReminderLevel } from "@/services/reminder-plan";

export interface ExternalTask {
  externalId: string;
  title: string;
  /** ISO datetime; day-only dues are stored at 23:59 local. */
  due?: string;
  done: boolean;
  url?: string;
  notes?: string;
  project?: string;
}

export interface TaskSyncPlan {
  create: Todo[];
  update: { id: string; changes: Partial<Todo> }[];
  completeLocal: string[];
  /** External ids to mark done upstream. */
  completeRemote: string[];
}

export function externalTodoId(provider: string, externalId: string): string {
  return `${provider}-${externalId}`.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 120);
}

export function planTaskSync(
  remote: ExternalTask[],
  local: Todo[],
  provider: string,
  opts: { reminder: ReminderLevel; canCompleteRemote: boolean; now?: Date },
): TaskSyncPlan {
  const plan: TaskSyncPlan = { create: [], update: [], completeLocal: [], completeRemote: [] };
  const mine = new Map(local.filter((t) => t.external?.provider === provider).map((t) => [t.external!.id, t]));
  const seen = new Set<string>();
  const now = (opts.now ?? new Date()).toISOString();

  for (const r of remote) {
    seen.add(r.externalId);
    const cur = mine.get(r.externalId);
    if (!cur) {
      if (r.done) continue;
      plan.create.push({
        id: externalTodoId(provider, r.externalId),
        title: r.title.slice(0, 200) || "(Untitled)",
        completed: false,
        dueDate: r.due,
        priority: "medium",
        category: provider.split(":")[0],
        tags: r.project ? [r.project] : [],
        createdAt: now,
        reminder: r.due ? opts.reminder : "off",
        subject: r.project,
        external: { provider, id: r.externalId, url: r.url },
      });
      continue;
    }
    if (cur.completed && !r.done) {
      if (opts.canCompleteRemote) plan.completeRemote.push(r.externalId);
      continue;
    }
    if (!cur.completed && r.done) {
      plan.completeLocal.push(cur.id);
      continue;
    }
    const changes: Partial<Todo> = {};
    if (r.title && r.title !== cur.title) changes.title = r.title.slice(0, 200);
    if ((r.due ?? undefined) !== (cur.dueDate ?? undefined)) changes.dueDate = r.due;
    if (r.url && r.url !== cur.external?.url) changes.external = { provider, id: r.externalId, url: r.url };
    if (Object.keys(changes).length) plan.update.push({ id: cur.id, changes });
  }

  for (const [extId, t] of mine) {
    if (!seen.has(extId) && !t.completed) plan.completeLocal.push(t.id);
  }
  return plan;
}

/** Day-only due ("2026-10-15") → 23:59 local; full datetimes pass through. */
export function normalizeDue(date?: string | null, datetime?: string | null): string | undefined {
  if (datetime && !isNaN(Date.parse(datetime))) return new Date(datetime).toISOString();
  if (!date) return undefined;
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 23, 59).toISOString();
  return isNaN(Date.parse(date)) ? undefined : new Date(date).toISOString();
}

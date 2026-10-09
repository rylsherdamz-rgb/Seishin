import { useTodoStore } from "@/stores/todo-store";
import { http } from "./http";
import { getToken } from "./secrets";
import { todoistState } from "./state";
import { normalizeDue, planTaskSync, type ExternalTask } from "./task-sync-plan";

const API = "https://api.todoist.com/api/v1";
const PROVIDER = "todoist";

interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  checked?: boolean;
  is_completed?: boolean;
  due?: { date?: string; datetime?: string | null } | null;
  url?: string;
}

/** Active tasks. Accepts the unified v1 paged shape and the older plain-array shape. */
export async function fetchTodoistTasks(token: string): Promise<ExternalTask[]> {
  const all: TodoistTask[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page++) {
    const url: string = `${API}/tasks?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    type Page = { results?: TodoistTask[]; next_cursor?: string | null } | TodoistTask[];
    const res: Page = await http<Page>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (Array.isArray(res)) { all.push(...res); break; }
    all.push(...(res.results ?? []));
    cursor = res.next_cursor ?? null;
    if (!cursor) break;
  }
  return all.map((t) => ({
    externalId: String(t.id),
    title: t.content,
    due: normalizeDue(t.due?.date, t.due?.datetime),
    done: !!(t.checked ?? t.is_completed),
    url: t.url ?? `https://app.todoist.com/app/task/${t.id}`,
    notes: t.description || undefined,
  }));
}

export async function verifyTodoist(token: string): Promise<number> {
  return (await fetchTodoistTasks(token)).length;
}

export async function syncTodoist(): Promise<number> {
  const state = todoistState.get();
  if (!state.enabled) return 0;
  const token = await getToken(PROVIDER);
  if (!token) { todoistState.set({ lastError: "Reconnect Todoist — token missing" }); return 0; }
  try {
    const remote = await fetchTodoistTasks(token);
    const store = useTodoStore.getState();
    const plan = planTaskSync(remote, store.todos, PROVIDER, { reminder: state.reminder, canCompleteRemote: true });
    for (const id of plan.completeRemote) {
      await http(`${API}/tasks/${id}/close`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    store.applySync(plan.create, plan.update, plan.completeLocal);
    todoistState.set({ lastSync: new Date().toISOString(), lastError: null });
    return plan.create.length + plan.update.length + plan.completeLocal.length + plan.completeRemote.length;
  } catch (e) {
    todoistState.set({ lastError: e instanceof Error ? e.message : "Sync failed" });
    return 0;
  }
}

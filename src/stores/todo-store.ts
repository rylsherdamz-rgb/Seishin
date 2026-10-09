import { create } from "zustand";
import { todosStorage } from "./mmkv";
import { isNonEmptyString, isRecord, readList, sizeOf, writeJSON } from "./persist";
import type { ReminderLevel } from "@/services/reminder-plan";

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: string;
  priority: "low" | "medium" | "high";
  category: string;
  tags: string[];
  createdAt: string;
  completedAt?: string;
  inviteId?: string;
  eventId?: string;
  /** Questions / parts to answer (from Smart capture), checked off one by one. */
  items?: TodoItem[];
  /** How hard to remind: "persistent" keeps nudging until done. */
  reminder?: ReminderLevel;
  /** Note holding the source photos + scanned text. */
  noteId?: string;
  subject?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

type TodoFilter = "all" | "active" | "completed";

interface TodoState {
  todos: Todo[];
  filter: TodoFilter;
  loadTodos: () => void;
  addTodo: (todo: Todo) => boolean;
  toggleTodo: (id: string) => boolean;
  updateTodo: (id: string, changes: Partial<Todo>) => boolean;
  deleteTodo: (id: string) => boolean;
  clearCompleted: () => boolean;
  setFilter: (filter: TodoFilter) => void;
  getFilteredTodos: () => Todo[];
  getStats: () => { total: number; active: number; completed: number };
  getTodosForEvent: (eventId: string) => Todo[];
  toggleItem: (todoId: string, itemId: string) => boolean;
  clearAll: () => void;
  getStorageSize: () => number;
}

// Legacy key (pre `{domain}:{subdomain}:{id}`), kept for existing installs.
const TODOS_KEY = "todos";
const PRIORITIES: Todo["priority"][] = ["low", "medium", "high"];

/** Runtime guard for persisted tasks; fills safe defaults for optional fields. */
export function isTodo(x: unknown): x is Todo {
  if (!isRecord(x)) return false;
  if (!isNonEmptyString(x.id) || typeof x.title !== "string") return false;
  if (typeof x.completed !== "boolean") x.completed = false;
  if (!PRIORITIES.includes(x.priority as Todo["priority"])) x.priority = "medium";
  if (typeof x.category !== "string") x.category = "general";
  if (!Array.isArray(x.tags)) x.tags = [];
  if (typeof x.createdAt !== "string") x.createdAt = new Date(0).toISOString();
  return true;
}

// Reminders are scheduled lazily (native module) so the store stays usable in
// tests and never blocks a save on notification work.
type ReminderService = typeof import("@/services/task-reminders");
function reminders(): ReminderService | null {
  try {
    // Lazy require (not import()): works under Metro and Jest alike.
    return require("@/services/task-reminders") as ReminderService;
  } catch {
    return null;
  }
}
function syncReminders(t: Todo) {
  reminders()?.scheduleTaskReminders(t).catch(() => {});
}
function cancelReminders(id: string) {
  reminders()?.cancelTaskReminders(id).catch(() => {});
}

export const useTodoStore = create<TodoState>((set, get) => {
  /** Persist first, then publish — the UI never shows unsaved state. */
  const commit = (todos: Todo[]): boolean => {
    if (!writeJSON(todosStorage, TODOS_KEY, todos)) return false;
    set({ todos });
    return true;
  };

  return {
    todos: [],
    filter: "all",

    loadTodos: () => set({ todos: readList(todosStorage, TODOS_KEY, isTodo) }),

    addTodo: (todo) => {
      const ok = commit([todo, ...get().todos]);
      if (ok) syncReminders(todo);
      return ok;
    },

    toggleTodo: (id) => {
      const ok = commit(
        get().todos.map((t) =>
          t.id === id
            ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
            : t,
        ),
      );
      const t = get().todos.find((x) => x.id === id);
      if (ok && t) syncReminders(t);
      return ok;
    },

    updateTodo: (id, changes) => {
      const ok = commit(get().todos.map((t) => (t.id === id ? { ...t, ...changes, id } : t)));
      const t = get().todos.find((x) => x.id === id);
      if (ok && t && ("dueDate" in changes || "reminder" in changes || "completed" in changes || "title" in changes)) syncReminders(t);
      return ok;
    },

    deleteTodo: (id) => {
      const ok = commit(get().todos.filter((t) => t.id !== id));
      if (ok) cancelReminders(id);
      return ok;
    },

    toggleItem: (todoId, itemId) =>
      commit(
        get().todos.map((t) =>
          t.id === todoId && t.items
            ? { ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
            : t,
        ),
      ),

    clearCompleted: () => {
      const done = get().todos.filter((t) => t.completed);
      const ok = commit(get().todos.filter((t) => !t.completed));
      if (ok) done.forEach((t) => cancelReminders(t.id));
      return ok;
    },

    setFilter: (filter) => set({ filter }),

    getFilteredTodos: () => {
      const { todos, filter } = get();
      if (filter === "active") return todos.filter((t) => !t.completed);
      if (filter === "completed") return todos.filter((t) => t.completed);
      return todos;
    },

    getStats: () => {
      const { todos } = get();
      const completed = todos.filter((t) => t.completed).length;
      return { total: todos.length, active: todos.length - completed, completed };
    },

    getTodosForEvent: (eventId) => get().todos.filter((t) => t.eventId === eventId),

    clearAll: () => {
      get().todos.forEach((t) => cancelReminders(t.id));
      todosStorage.remove(TODOS_KEY);
      set({ todos: [] });
    },

    getStorageSize: () => sizeOf(todosStorage, TODOS_KEY),
  };
});

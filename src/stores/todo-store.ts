import { create } from "zustand";
import { todosStorage } from "./mmkv";
import { isNonEmptyString, isRecord, readList, sizeOf, writeJSON } from "./persist";

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

    addTodo: (todo) => commit([todo, ...get().todos]),

    toggleTodo: (id) =>
      commit(
        get().todos.map((t) =>
          t.id === id
            ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
            : t,
        ),
      ),

    updateTodo: (id, changes) => commit(get().todos.map((t) => (t.id === id ? { ...t, ...changes, id } : t))),

    deleteTodo: (id) => commit(get().todos.filter((t) => t.id !== id)),

    clearCompleted: () => commit(get().todos.filter((t) => !t.completed)),

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
      todosStorage.remove(TODOS_KEY);
      set({ todos: [] });
    },

    getStorageSize: () => sizeOf(todosStorage, TODOS_KEY),
  };
});

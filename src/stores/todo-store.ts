import { create } from "zustand";
import { todosStorage } from "./mmkv";

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
}

type TodoFilter = "all" | "active" | "completed";

interface TodoState {
  todos: Todo[];
  filter: TodoFilter;
  loadTodos: () => void;
  addTodo: (todo: Todo) => void;
  toggleTodo: (id: string) => void;
  updateTodo: (id: string, changes: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  clearCompleted: () => void;
  setFilter: (filter: TodoFilter) => void;
  getFilteredTodos: () => Todo[];
  getStats: () => { total: number; active: number; completed: number };
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  filter: "all",

  loadTodos: () => {
    const raw = todosStorage.getString("todos");
    if (raw) set({ todos: JSON.parse(raw) });
  },

  addTodo: (todo) => {
    const todos = [todo, ...get().todos];
    todosStorage.set("todos", JSON.stringify(todos));
    set({ todos });
  },

  toggleTodo: (id) => {
    const todos = get().todos.map((t) =>
      t.id === id
        ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
        : t
    );
    todosStorage.set("todos", JSON.stringify(todos));
    set({ todos });
  },

  updateTodo: (id, changes) => {
    const todos = get().todos.map((t) => (t.id === id ? { ...t, ...changes } : t));
    todosStorage.set("todos", JSON.stringify(todos));
    set({ todos });
  },

  deleteTodo: (id) => {
    const todos = get().todos.filter((t) => t.id !== id);
    todosStorage.set("todos", JSON.stringify(todos));
    set({ todos });
  },

  clearCompleted: () => {
    const todos = get().todos.filter((t) => !t.completed);
    todosStorage.set("todos", JSON.stringify(todos));
    set({ todos });
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
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    return { total, active: total - completed, completed };
  },
}));

import { create } from "zustand";
import { notificationsStorage, emailsStorage, messagesStorage } from "./mmkv";

export interface InboxItem {
  id: string;
  type: "notification" | "email" | "chat";
  title: string;
  body: string;
  timestamp: string;
  source: string;
  read: boolean;
  deleted?: boolean;
  eventId?: string;
  pendingEvent?: { title: string; startDate: string; endDate: string; description?: string };
}

type InboxFilter = "all" | "notifications" | "emails" | "chats";

interface InboxState {
  items: InboxItem[];
  filter: InboxFilter;
  selectedIds: Set<string>;
  selecting: boolean;
  loadItems: () => void;
  addItem: (item: InboxItem) => void;
  markRead: (id: string) => void;
  deleteItem: (id: string) => void;
  clearAll: () => void;
  setFilter: (filter: InboxFilter) => void;
  getUnreadCount: () => number;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSelecting: (v: boolean) => void;
  deleteSelected: () => void;
  markSelectedRead: () => void;
}

const INBOX_KEY = "inbox_items";

export const useInboxStore = create<InboxState>((set, get) => ({
  items: [],
  filter: "all",
  selectedIds: new Set(),
  selecting: false,

  loadItems: () => {
    try {
      const raw = notificationsStorage.getString(INBOX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const now = new Date().toISOString();
          const sanitized = parsed
            .filter((i) => i && typeof i === "object" && typeof i.id === "string")
            .map((i) => ({
              id: i.id,
              type: i.type === "email" || i.type === "chat" ? i.type : "notification",
              title: typeof i.title === "string" ? i.title : "",
              body: typeof i.body === "string" ? i.body : "",
              timestamp: typeof i.timestamp === "string" ? i.timestamp : now,
              source: typeof i.source === "string" ? i.source : "",
              read: !!i.read,
              deleted: i.deleted,
              eventId: i.eventId,
              pendingEvent: i.pendingEvent,
            }));
          set({ items: sanitized });
        }
      }
    } catch {
      notificationsStorage.set(INBOX_KEY, JSON.stringify([]));
    }
  },

  addItem: (item) => {
    const items = [item, ...get().items].slice(0, 500);
    notificationsStorage.set(INBOX_KEY, JSON.stringify(items));
    set({ items });
  },

  markRead: (id) => {
    const items = get().items.map((i) =>
      i.id === id ? { ...i, read: true } : i
    );
    notificationsStorage.set(INBOX_KEY, JSON.stringify(items));
    set({ items });
  },

  deleteItem: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    notificationsStorage.set(INBOX_KEY, JSON.stringify(items));
    set({ items });
  },

  clearAll: () => {
    notificationsStorage.set(INBOX_KEY, JSON.stringify([]));
    set({ items: [], selectedIds: new Set(), selecting: false });
  },

  setFilter: (filter) => set({ filter }),

  getUnreadCount: () => get().items.filter((i) => !i.read).length,

  toggleSelect: (id) => {
    const selectedIds = new Set(get().selectedIds);
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    set({ selectedIds });
  },

  selectAll: () => {
    const all = get().items.map((i) => i.id);
    set({ selectedIds: new Set(all) });
  },

  clearSelection: () => set({ selectedIds: new Set(), selecting: false }),

  setSelecting: (v) => set({ selecting: v, selectedIds: new Set() }),

  deleteSelected: () => {
    const selected = get().selectedIds;
    const items = get().items.filter((i) => !selected.has(i.id));
    notificationsStorage.set(INBOX_KEY, JSON.stringify(items));
    set({ items, selectedIds: new Set(), selecting: false });
  },

  markSelectedRead: () => {
    const selected = get().selectedIds;
    const items = get().items.map((i) =>
      selected.has(i.id) ? { ...i, read: true } : i
    );
    notificationsStorage.set(INBOX_KEY, JSON.stringify(items));
    set({ items, selectedIds: new Set(), selecting: false });
  },
}));

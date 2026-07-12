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
}

type InboxFilter = "all" | "notifications" | "emails" | "chats";

interface InboxState {
  items: InboxItem[];
  filter: InboxFilter;
  loadItems: () => void;
  addItem: (item: InboxItem) => void;
  markRead: (id: string) => void;
  deleteItem: (id: string) => void;
  clearAll: () => void;
  setFilter: (filter: InboxFilter) => void;
  getUnreadCount: () => number;
}

const INBOX_KEY = "inbox_items";

export const useInboxStore = create<InboxState>((set, get) => ({
  items: [],
  filter: "all",

  loadItems: () => {
    try {
      const raw = notificationsStorage.getString(INBOX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) set({ items: parsed });
      }
    } catch {
      // ponytail: corrupted inbox data → reset to empty, no crash
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
    set({ items: [] });
  },

  setFilter: (filter) => set({ filter }),

  getUnreadCount: () => get().items.filter((i) => !i.read).length,
}));

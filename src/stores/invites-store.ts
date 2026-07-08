import { create } from "zustand";
import { invitesStorage, messagesStorage } from "./mmkv";

export interface InviteCard {
  id: string;
  type: "invite-card" | "p2p-code" | "shared-todo";
  title: string;
  description?: string;
  eventId?: string;
  todoId?: string;
  code?: string;
  peerId?: string;
  status: "draft" | "sent" | "received" | "accepted" | "declined";
  createdAt: string;
  expiresAt?: string;
  data: Record<string, string>;
}

interface InvitesState {
  invites: InviteCard[];
  loadInvites: () => void;
  addInvite: (invite: InviteCard) => void;
  updateInvite: (id: string, changes: Partial<InviteCard>) => void;
  deleteInvite: (id: string) => void;
  generateP2pCode: () => string;
  shareTodoList: (todoIds: string[]) => string;
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const useInvitesStore = create<InvitesState>((set, get) => ({
  invites: [],

  loadInvites: () => {
    const raw = invitesStorage.getString("invites");
    if (raw) set({ invites: JSON.parse(raw) });
  },

  addInvite: (invite) => {
    const invites = [invite, ...get().invites];
    invitesStorage.set("invites", JSON.stringify(invites));
    set({ invites });
  },

  updateInvite: (id, changes) => {
    const invites = get().invites.map((i) => (i.id === id ? { ...i, ...changes } : i));
    invitesStorage.set("invites", JSON.stringify(invites));
    set({ invites });
  },

  deleteInvite: (id) => {
    const invites = get().invites.filter((i) => i.id !== id);
    invitesStorage.set("invites", JSON.stringify(invites));
    set({ invites });
  },

  generateP2pCode: () => {
    const code = randomCode();
    const invite: InviteCard = {
      id: `p2p-${Date.now()}`,
      type: "p2p-code",
      title: `P2P Code: ${code}`,
      code,
      status: "draft",
      createdAt: new Date().toISOString(),
      data: {},
    };
    get().addInvite(invite);
    return code;
  },

  shareTodoList: (todoIds: string[]) => {
    const code = randomCode();
    const invite: InviteCard = {
      id: `share-${Date.now()}`,
      type: "shared-todo",
      title: `Shared Todo List (${todoIds.length} items)`,
      code,
      status: "draft",
      createdAt: new Date().toISOString(),
      data: { todoIds: JSON.stringify(todoIds) },
    };
    get().addInvite(invite);
    return code;
  },
}));

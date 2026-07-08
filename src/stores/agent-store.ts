import { create } from "zustand";
import { agentStorage } from "./mmkv";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
  toolName?: string;
  toolResult?: string;
}

export interface Skill {
  name: string;
  version: string;
  description: string;
  tools: string[];
  installed: boolean;
}

type Provider = "nim" | "local";

interface AgentState {
  messages: AgentMessage[];
  currentProvider: Provider;
  installedSkills: Skill[];
  isProcessing: boolean;

  load: () => void;
  addMessage: (msg: AgentMessage) => void;
  setProvider: (provider: Provider) => void;
  installSkill: (skill: Skill) => void;
  removeSkill: (name: string) => void;
  clearConversation: () => void;
  setProcessing: (v: boolean) => void;
}

const MESSAGES_KEY = "conversation";
const SKILLS_KEY = "skills";
const MAX_MESSAGES = 100;

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [],
  currentProvider: "local",
  installedSkills: [],
  isProcessing: false,

  load: () => {
    const msgs = agentStorage.getString(MESSAGES_KEY);
    const skills = agentStorage.getString(SKILLS_KEY);
    const provider = agentStorage.getString("provider");
    if (msgs) set({ messages: JSON.parse(msgs) });
    if (skills) set({ installedSkills: JSON.parse(skills) });
    if (provider) set({ currentProvider: provider as Provider });
  },

  addMessage: (msg) => {
    const messages = [...get().messages, msg].slice(-MAX_MESSAGES);
    agentStorage.set(MESSAGES_KEY, JSON.stringify(messages));
    set({ messages });
  },

  setProvider: (provider) => {
    agentStorage.set("provider", provider);
    set({ currentProvider: provider });
  },

  installSkill: (skill) => {
    const installedSkills = [...get().installedSkills, { ...skill, installed: true }];
    agentStorage.set(SKILLS_KEY, JSON.stringify(installedSkills));
    set({ installedSkills });
  },

  removeSkill: (name) => {
    const installedSkills = get().installedSkills.filter((s) => s.name !== name);
    agentStorage.set(SKILLS_KEY, JSON.stringify(installedSkills));
    set({ installedSkills });
  },

  clearConversation: () => {
    agentStorage.set(MESSAGES_KEY, JSON.stringify([]));
    set({ messages: [] });
  },

  setProcessing: (v) => set({ isProcessing: v }),
}));

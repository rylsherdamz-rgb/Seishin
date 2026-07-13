import { create } from "zustand";
import { agentStorage } from "./mmkv";

export interface ToolCallData {
  id: string;
  name: string;
  arguments: string;
}

export interface AgentAttachment {
  type: "image" | "file";
  uri: string;
  name?: string;
  mimeType?: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
  toolName?: string;
  toolResult?: string;
  toolCallId?: string;
  toolCalls?: ToolCallData[];
  attachments?: AgentAttachment[];
}

export interface Skill {
  name: string;
  version: string;
  description: string;
  tools: string[];
  installed: boolean;
}

type Provider = "nim" | "local";
type ModelState = "unloaded" | "loading" | "ready" | "error";

interface AgentState {
  messages: AgentMessage[];
  currentProvider: Provider;
  installedSkills: Skill[];
  isProcessing: boolean;
  streamTick: number;
  modelState: ModelState;
  modelProgress: number;
  modelError: string | null;

  load: () => void;
  addMessage: (msg: AgentMessage) => void;
  setProvider: (provider: Provider) => void;
  installSkill: (skill: Skill) => void;
  removeSkill: (name: string) => void;
  clearConversation: () => void;
  setProcessing: (v: boolean) => void;
  updateAssistantMessage: (id: string, content: string, toolCalls?: ToolCallData[]) => void;
  setModelState: (state: ModelState, progress?: number, error?: string | null) => void;
}

const MESSAGES_KEY = "conversation";
const SKILLS_KEY = "skills";
const MAX_MESSAGES = 100;

export const useAgentStore = create<AgentState>((set, get) => ({
  messages: [],
  currentProvider: "local",
  installedSkills: [],
  isProcessing: false,
  streamTick: 0,
  modelState: "unloaded",
  modelProgress: 0,
  modelError: null,

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

  updateAssistantMessage: (id: string, content: string, toolCalls?: ToolCallData[]) => {
    const messages = get().messages.map((m) =>
      m.id === id ? { ...m, content, ...(toolCalls ? { toolCalls } : {}) } : m
    );
    set({ messages, streamTick: get().streamTick + 1 });
  },

  setModelState: (state, progress = 0, error = null) => {
    set({ modelState: state, modelProgress: progress, modelError: error });
  },
}));

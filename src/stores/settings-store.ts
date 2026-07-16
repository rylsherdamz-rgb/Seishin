import { create } from "zustand";
import { settingsStorage } from "./mmkv";

interface CleanupPolicy {
  notificationsDays: number;
  emailsDays: number;
  chatDays: number;
  ocrDays: number;
}

interface SettingsState {
  emailConfig: {
    host: string;
    port: number;
    user: string;
    pass: string;
  } | null;
  apiKeys: {
    nim: string;
  };
  nimEndpoint: string;
  nimModel: string;
  nimLargeModel: string | null;
  nimCachedModels: string[];
  modelPath: string | null;
  cleanupPolicies: CleanupPolicy;
  notificationFilter: string[];
  darkMode: boolean;

  loadSettings: () => void;
  setEmailConfig: (config: SettingsState["emailConfig"]) => void;
  setApiKey: (provider: "nim", key: string) => void;
  setNimEndpoint: (endpoint: string) => void;
  setNimModel: (model: string) => void;
  setNimLargeModel: (model: string | null) => void;
  setNimCachedModels: (models: string[]) => void;
  setModelPath: (path: string | null) => void;
  setCleanupPolicies: (policies: Partial<CleanupPolicy>) => void;
  setNotificationFilter: (packages: string[]) => void;
  setDarkMode: (v: boolean) => void;
}

const DEFAULT_CLEANUP: CleanupPolicy = {
  notificationsDays: 14,
  emailsDays: 30,
  chatDays: 90,
  ocrDays: 7,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  emailConfig: null,
  apiKeys: { nim: "", youtubeApiKey: "" },
  nimEndpoint: "https://integrate.api.nvidia.com/v1",
  nimModel: "meta/llama-3.2-1b-instruct",
  nimLargeModel: null,
  nimCachedModels: [],
  modelPath: null,
  cleanupPolicies: DEFAULT_CLEANUP,
  notificationFilter: [],
  darkMode: true,

  loadSettings: () => {
    const emailRaw = settingsStorage.getString("emailConfig");
    const apiKeysRaw = settingsStorage.getString("apiKeys");
    const nimEndpoint = settingsStorage.getString("nimEndpoint");
    const nimModel = settingsStorage.getString("nimModel");
    const nimLargeModel = settingsStorage.getString("nimLargeModel");
    const nimCachedModels = settingsStorage.getString("nimCachedModels");
    const modelPath = settingsStorage.getString("modelPath");
    const cleanupRaw = settingsStorage.getString("cleanupPolicies");
    const notifFilterRaw = settingsStorage.getString("notificationFilter");
    const darkMode = settingsStorage.getBoolean("darkMode");

    if (emailRaw) set({ emailConfig: JSON.parse(emailRaw) });
    if (apiKeysRaw) set({ apiKeys: JSON.parse(apiKeysRaw) });
    if (nimEndpoint) set({ nimEndpoint });
    if (nimModel) set({ nimModel });
    if (nimLargeModel) set({ nimLargeModel });
    if (nimCachedModels) set({ nimCachedModels: JSON.parse(nimCachedModels) });
    if (modelPath) set({ modelPath });
    if (cleanupRaw) set({ cleanupPolicies: JSON.parse(cleanupRaw) });
    if (notifFilterRaw) set({ notificationFilter: JSON.parse(notifFilterRaw) });
    if (darkMode !== null) set({ darkMode });
  },

  setEmailConfig: (config) => {
    settingsStorage.set("emailConfig", JSON.stringify(config));
    set({ emailConfig: config });
  },

  setApiKey: (provider, key) => {
    const apiKeys = { ...get().apiKeys, [provider]: key };
    settingsStorage.set("apiKeys", JSON.stringify(apiKeys));
    set({ apiKeys });
  },

  setNimEndpoint: (endpoint) => {
    settingsStorage.set("nimEndpoint", endpoint);
    set({ nimEndpoint: endpoint });
  },

  setNimModel: (model) => {
    settingsStorage.set("nimModel", model);
    set({ nimModel: model });
  },

  setNimLargeModel: (model) => {
    if (model) settingsStorage.set("nimLargeModel", model);
    else settingsStorage.remove("nimLargeModel");
    set({ nimLargeModel: model });
  },

  setNimCachedModels: (models) => {
    settingsStorage.set("nimCachedModels", JSON.stringify(models));
    set({ nimCachedModels: models });
  },

  setModelPath: (path) => {
    if (path) settingsStorage.set("modelPath", path);
    else settingsStorage.remove("modelPath");
    set({ modelPath: path });
  },

  setCleanupPolicies: (policies) => {
    const cleanupPolicies = { ...get().cleanupPolicies, ...policies };
    settingsStorage.set("cleanupPolicies", JSON.stringify(cleanupPolicies));
    set({ cleanupPolicies });
  },

  setNotificationFilter: (packages) => {
    settingsStorage.set("notificationFilter", JSON.stringify(packages));
    set({ notificationFilter: packages });
  },

  setDarkMode: (v) => {
    settingsStorage.set("darkMode", v);
    set({ darkMode: v });
  },
}));

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
  modelPath: string | null;
  cleanupPolicies: CleanupPolicy;
  notificationFilter: string[];

  loadSettings: () => void;
  setEmailConfig: (config: SettingsState["emailConfig"]) => void;
  setApiKey: (provider: "nim", key: string) => void;
  setModelPath: (path: string | null) => void;
  setCleanupPolicies: (policies: Partial<CleanupPolicy>) => void;
  setNotificationFilter: (packages: string[]) => void;
}

const DEFAULT_CLEANUP: CleanupPolicy = {
  notificationsDays: 14,
  emailsDays: 30,
  chatDays: 90,
  ocrDays: 7,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  emailConfig: null,
  apiKeys: { nim: "" },
  modelPath: null,
  cleanupPolicies: DEFAULT_CLEANUP,
  notificationFilter: [],

  loadSettings: () => {
    const emailRaw = settingsStorage.getString("emailConfig");
    const apiKeysRaw = settingsStorage.getString("apiKeys");
    const modelPath = settingsStorage.getString("modelPath");
    const cleanupRaw = settingsStorage.getString("cleanupPolicies");
    const notifFilterRaw = settingsStorage.getString("notificationFilter");

    if (emailRaw) set({ emailConfig: JSON.parse(emailRaw) });
    if (apiKeysRaw) set({ apiKeys: JSON.parse(apiKeysRaw) });
    if (modelPath) set({ modelPath });
    if (cleanupRaw) set({ cleanupPolicies: JSON.parse(cleanupRaw) });
    if (notifFilterRaw) set({ notificationFilter: JSON.parse(notifFilterRaw) });
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
}));

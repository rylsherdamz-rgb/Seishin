import { create } from "zustand";
import { settingsStorage } from "./mmkv";
import { deleteToken, getToken, setToken } from "@/services/connectors/secrets";

/** JSON setting that tolerates corrupt values instead of crashing on launch. */
function parse<T>(key: string): T | undefined {
  try {
    const raw = settingsStorage.getString(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

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
  /** Selected alarm ringtone. Empty/null means the system default alarm sound. */
  alarmRingtoneUri: string | null;
  alarmRingtoneName: string;

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
  setAlarmRingtone: (uri: string | null, name: string) => void;
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
  nimEndpoint: "https://integrate.api.nvidia.com/v1",
  nimModel: "meta/llama-3.2-1b-instruct",
  nimLargeModel: null,
  nimCachedModels: [],
  modelPath: null,
  cleanupPolicies: DEFAULT_CLEANUP,
  notificationFilter: [],
  alarmRingtoneUri: null,
  alarmRingtoneName: "Default alarm sound",

  loadSettings: () => {
    const str = (k: string) => settingsStorage.getString(k) ?? undefined;
    const nimEndpoint = str("nimEndpoint");
    const nimModel = str("nimModel");
    const nimLargeModel = str("nimLargeModel");
    const modelPath = str("modelPath");
    const alarmRingtoneUri = str("alarmRingtoneUri");
    const alarmRingtoneName = str("alarmRingtoneName");
    const nimCachedModels = parse<string[]>("nimCachedModels");
    const cleanup = parse<CleanupPolicy>("cleanupPolicies");
    const notifFilter = parse<string[]>("notificationFilter");
    const email = parse<NonNullable<SettingsState["emailConfig"]>>("emailConfig");

    if (nimEndpoint) set({ nimEndpoint });
    if (nimModel) set({ nimModel });
    if (nimLargeModel) set({ nimLargeModel });
    if (Array.isArray(nimCachedModels)) set({ nimCachedModels });
    if (modelPath) set({ modelPath });
    if (cleanup) set({ cleanupPolicies: { ...DEFAULT_CLEANUP, ...cleanup } });
    if (Array.isArray(notifFilter)) set({ notificationFilter: notifFilter });
    if (alarmRingtoneUri) set({ alarmRingtoneUri });
    if (alarmRingtoneName) set({ alarmRingtoneName });

    // Secrets live in the Keystore. Older installs kept them in plain MMKV:
    // move them over once, then erase the plaintext copies.
    const legacyKeys = parse<{ nim?: string }>("apiKeys");
    if (legacyKeys?.nim) {
      setToken("nim", legacyKeys.nim).then((ok) => { if (ok) settingsStorage.remove("apiKeys"); });
      set({ apiKeys: { nim: legacyKeys.nim } });
    } else if (legacyKeys) {
      settingsStorage.remove("apiKeys");
    }
    if (email?.pass) {
      setToken("email", email.pass).then((ok) => {
        if (ok) settingsStorage.set("emailConfig", JSON.stringify({ ...email, pass: "" }));
      });
    }
    if (email) set({ emailConfig: email });
    getToken("nim").then((nim) => { if (nim) set({ apiKeys: { ...get().apiKeys, nim } }); });
    if (email && !email.pass) {
      getToken("email").then((pass) => { if (pass) set({ emailConfig: { ...email, pass } }); });
    }
  },

  setEmailConfig: (config) => {
    // Password goes to the Keystore; everything else is ordinary settings.
    if (config?.pass) setToken("email", config.pass);
    else deleteToken("email");
    settingsStorage.set("emailConfig", JSON.stringify(config ? { ...config, pass: "" } : null));
    set({ emailConfig: config });
  },

  setApiKey: (provider, key) => {
    const apiKeys = { ...get().apiKeys, [provider]: key };
    if (key.trim()) setToken(provider, key);
    else deleteToken(provider);
    settingsStorage.remove("apiKeys");
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

  setAlarmRingtone: (uri, name) => {
    if (uri) settingsStorage.set("alarmRingtoneUri", uri);
    else settingsStorage.remove("alarmRingtoneUri");
    settingsStorage.set("alarmRingtoneName", name);
    set({ alarmRingtoneUri: uri, alarmRingtoneName: name });
  },
}));

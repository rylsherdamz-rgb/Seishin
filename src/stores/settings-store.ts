import { create } from "zustand";
import { settingsStorage } from "./mmkv";
import { deleteToken, getToken, setToken } from "@/services/connectors/secrets";
import { createLogger } from "@/utils/logger";

const log = createLogger("settings");

interface CleanupPolicy {
  notificationsDays: number;
  emailsDays: number;
  chatDays: number;
  ocrDays: number;
}

interface SettingsState {
  /** Held in memory only; persisted in SecureStore (see `ensureSecrets`). */
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

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = settingsStorage.getString(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    log.warn(`${key} is corrupt; using default`, e);
    return fallback;
  }
}

/** Everything except the API key — read synchronously from MMKV. */
function readSettings() {
  return {
    nimEndpoint: settingsStorage.getString("nimEndpoint") || "https://integrate.api.nvidia.com/v1",
    nimModel: settingsStorage.getString("nimModel") || "meta/llama-3.2-1b-instruct",
    nimLargeModel: settingsStorage.getString("nimLargeModel") || null,
    nimCachedModels: readJSON<string[]>("nimCachedModels", []),
    modelPath: settingsStorage.getString("modelPath") || null,
    cleanupPolicies: { ...DEFAULT_CLEANUP, ...readJSON<Partial<CleanupPolicy>>("cleanupPolicies", {}) },
    notificationFilter: readJSON<string[]>("notificationFilter", []),
    alarmRingtoneUri: settingsStorage.getString("alarmRingtoneUri") || null,
    alarmRingtoneName: settingsStorage.getString("alarmRingtoneName") || "Default alarm sound",
  };
}

const NIM_SECRET = "nim";
let secretsLoaded: Promise<void> | null = null;

/**
 * Load the NIM key from SecureStore into memory. Older builds kept it as
 * plain text in MMKV; move it across once and wipe the plain copy.
 */
export function ensureSecrets(): Promise<void> {
  if (!secretsLoaded) {
    secretsLoaded = (async () => {
      let nim = (await getToken(NIM_SECRET)) ?? "";
      const legacy = readJSON<{ nim?: string }>("apiKeys", {});
      if (legacy.nim) {
        if (!nim) nim = legacy.nim;
        if (await setToken(NIM_SECRET, nim)) settingsStorage.remove("apiKeys");
      }
      settingsStorage.remove("emailConfig"); // unused; held a plain-text password
      // Don't clobber a key the user typed while this was loading.
      if (!useSettingsStore.getState().apiKeys.nim) useSettingsStore.setState({ apiKeys: { nim } });
    })().catch((e) => log.error("secret load failed", e));
  }
  return secretsLoaded;
}

/** The NIM key, waiting for SecureStore on a cold start (e.g. background tasks). */
export async function getNimKey(): Promise<string> {
  await ensureSecrets();
  return useSettingsStore.getState().apiKeys.nim;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiKeys: { nim: "" },
  ...readSettings(),

  loadSettings: () => {
    set(readSettings());
    void ensureSecrets();
  },

  setApiKey: (provider, key) => {
    const value = key.trim();
    set({ apiKeys: { ...get().apiKeys, [provider]: value } });
    void (value ? setToken(provider, value) : deleteToken(provider));
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

void ensureSecrets();

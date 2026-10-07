import { create } from "zustand";
import { settingsStorage } from "./mmkv";
import { ACCENTS, THEMES, type AccentId, type ThemeMode } from "@/theme/themes";

const KEY_MODE = "settings:theme:mode";
const KEY_ACCENT = "settings:theme:accent";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentId;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  clearAll: () => void;
  getStorageSize: () => number;
}

function readMode(): ThemeMode {
  try {
    const v = settingsStorage.getString(KEY_MODE);
    if (v === "system" || (v && v in THEMES)) return v as ThemeMode;
  } catch {
    // Fall through to the default on a corrupt/unavailable store.
  }
  return "light";
}

function readAccent(): AccentId {
  try {
    const v = settingsStorage.getString(KEY_ACCENT);
    if (v && v in ACCENTS) return v as AccentId;
  } catch {
    // Default below.
  }
  return "mono";
}

function persist(key: string, value: string) {
  try {
    settingsStorage.set(key, value);
  } catch {
    // Theme still applies for this session even if the write fails.
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readMode(),
  accent: readAccent(),

  setMode: (mode) => {
    persist(KEY_MODE, mode);
    set({ mode });
  },

  setAccent: (accent) => {
    persist(KEY_ACCENT, accent);
    set({ accent });
  },

  clearAll: () => {
    settingsStorage.remove(KEY_MODE);
    settingsStorage.remove(KEY_ACCENT);
    set({ mode: "light", accent: "mono" });
  },

  getStorageSize: () =>
    [KEY_MODE, KEY_ACCENT].filter((k) => settingsStorage.getString(k) != null).length,
}));

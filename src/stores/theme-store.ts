import { create } from "zustand";
import { settingsStorage } from "./mmkv";
import { ACCENTS, THEMES, type AccentId, type ThemeMode } from "@/theme/themes";
import {
  DENSITIES, START_TABS, TEXT_SIZES, TIME_FORMATS, formatTime,
  type Density, type StartTab, type TextSize, type TimeFormat, type WeekStart,
} from "@/theme/prefs";

const KEY_MODE = "settings:theme:mode";
const KEY_ACCENT = "settings:theme:accent";
const KEY_TIME = "settings:theme:timeFormat";
const KEY_WEEK = "settings:theme:weekStart";
const KEY_TEXT = "settings:theme:textSize";
const KEY_DENSITY = "settings:theme:density";
const KEY_START = "settings:theme:startTab";

/** Every key this store owns (backup + factory reset use the list). */
export const THEME_KEYS = [KEY_MODE, KEY_ACCENT, KEY_TIME, KEY_WEEK, KEY_TEXT, KEY_DENSITY, KEY_START];

export interface DisplayPrefs {
  timeFormat: TimeFormat;
  weekStart: WeekStart;
  textSize: TextSize;
  density: Density;
  startTab: StartTab;
}

const DEFAULT_PREFS: DisplayPrefs = {
  timeFormat: "12h",
  weekStart: 0,
  textSize: "default",
  density: "default",
  startTab: "index",
};

const PREF_KEYS: Record<keyof DisplayPrefs, string> = {
  timeFormat: KEY_TIME,
  weekStart: KEY_WEEK,
  textSize: KEY_TEXT,
  density: KEY_DENSITY,
  startTab: KEY_START,
};

interface ThemeState extends DisplayPrefs {
  mode: ThemeMode;
  accent: AccentId;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
  setPref: <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => void;
  /** Re-read everything from storage (after a backup restore). */
  reload: () => void;
  clearAll: () => void;
  getStorageSize: () => number;
}

function read(key: string): string | undefined {
  try {
    return settingsStorage.getString(key);
  } catch {
    // Fall through to the default on a corrupt/unavailable store.
    return undefined;
  }
}

function oneOf<T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T {
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function readAll() {
  const mode = read(KEY_MODE);
  const accent = read(KEY_ACCENT);
  return {
    mode: (mode === "system" || (mode && mode in THEMES) ? mode : "light") as ThemeMode,
    accent: (accent && accent in ACCENTS ? accent : "mono") as AccentId,
    timeFormat: oneOf(read(KEY_TIME), TIME_FORMATS, DEFAULT_PREFS.timeFormat),
    weekStart: (read(KEY_WEEK) === "1" ? 1 : 0) as WeekStart,
    textSize: oneOf(read(KEY_TEXT), TEXT_SIZES, DEFAULT_PREFS.textSize),
    density: oneOf(read(KEY_DENSITY), DENSITIES, DEFAULT_PREFS.density),
    startTab: oneOf(read(KEY_START), START_TABS, DEFAULT_PREFS.startTab),
  };
}

function persist(key: string, value: string) {
  try {
    settingsStorage.set(key, value);
  } catch {
    // Theme still applies for this session even if the write fails.
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  ...readAll(),

  setMode: (mode) => {
    persist(KEY_MODE, mode);
    set({ mode });
  },

  setAccent: (accent) => {
    persist(KEY_ACCENT, accent);
    set({ accent });
  },

  setPref: (key, value) => {
    persist(PREF_KEYS[key], String(value));
    set({ [key]: value } as Partial<DisplayPrefs>);
  },

  reload: () => set(readAll()),

  clearAll: () => {
    THEME_KEYS.forEach((k) => settingsStorage.remove(k));
    set({ mode: "light", accent: "mono", ...DEFAULT_PREFS });
  },

  getStorageSize: () => THEME_KEYS.filter((k) => settingsStorage.getString(k) != null).length,
}));

/** Current clock preference, for non-React code (widgets, notifications, utils). */
export const currentTimeFormat = (): TimeFormat => useThemeStore.getState().timeFormat;
export const currentWeekStart = (): WeekStart => useThemeStore.getState().weekStart;

/** Formats with the user's clock preference (reactive: re-renders on change). */
export function useFormatTime(): (d: Date) => string {
  const format = useThemeStore((s) => s.timeFormat);
  return (d: Date) => formatTime(d, format);
}

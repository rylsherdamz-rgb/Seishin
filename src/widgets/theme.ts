/**
 * Widget colors follow the app's theme choice: a fixed theme (Paper,
 * Midnight…) is used as-is; "System" gives the launcher a light and a dark
 * version so the widget flips with the phone.
 */
import { settingsStorage } from "@/stores/mmkv";
import { ACCENTS, THEMES, buildPalette, type AccentId, type Palette, type ThemeId } from "@/theme/themes";

export type Hex = `#${string}`;
export const hex = (s: string) => s as Hex;

export interface WidgetPalettes {
  light: Palette;
  dark: Palette | null;
}

export function widgetPalettes(): WidgetPalettes {
  let mode = "light";
  let accentId = "mono";
  try {
    mode = settingsStorage.getString("settings:theme:mode") ?? "light";
    accentId = settingsStorage.getString("settings:theme:accent") ?? "mono";
  } catch {
    // Defaults below.
  }
  const accent = ACCENTS[(accentId in ACCENTS ? accentId : "mono") as AccentId];
  if (mode === "system") return { light: buildPalette(THEMES.light, accent), dark: buildPalette(THEMES.dark, accent) };
  const theme = THEMES[(mode in THEMES ? mode : "light") as ThemeId];
  return { light: buildPalette(theme, accent), dark: null };
}

/** Deep link into the app (handled by app/open.tsx). */
export function openLink(to: string, params: Record<string, string> = {}) {
  const q = Object.entries({ to, ...params }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return { clickAction: "OPEN_URI" as const, clickActionData: { uri: `seishin://open?${q}` } };
}

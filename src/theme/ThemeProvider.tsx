import { useMemo } from "react";
import { View, useColorScheme } from "react-native";
import { vars } from "nativewind";
import { useThemeStore } from "@/stores/theme-store";
import { ACCENTS, THEMES, buildPalette, paletteToVars, type Palette, type ThemeDef, type ThemeId, type AccentId } from "./themes";

export interface ResolvedTheme {
  theme: ThemeDef;
  colors: Palette;
  dark: boolean;
}

// Palettes are pure functions of (theme, accent): build each once and share
// the same object everywhere, so hundreds of list rows calling useColors()
// don't each allocate a palette, and memoized children see stable references.
const cache = new Map<string, ResolvedTheme>();
function resolve(id: ThemeId, accent: AccentId): ResolvedTheme {
  const key = `${id}:${accent}`;
  let hit = cache.get(key);
  if (!hit) {
    const theme = THEMES[id];
    hit = { theme, colors: buildPalette(theme, ACCENTS[accent]), dark: theme.dark };
    cache.set(key, hit);
  }
  return hit;
}

/** Live theme: hex palette for props that can't take a className. */
export function useTheme(): ResolvedTheme {
  const mode = useThemeStore((s) => s.mode);
  const accentId = useThemeStore((s) => s.accent);
  const scheme = useColorScheme();
  const id: ThemeId = mode === "system" ? (scheme === "dark" ? "dark" : "light") : mode;
  return resolve(id, accentId);
}

/** Shorthand for the hex palette. */
export function useColors(): Palette {
  return useTheme().colors;
}

/**
 * Applies the active theme's CSS variables to everything beneath it, so all
 * NativeWind color classes (`bg-white`, `text-ink-500`, `bg-accent`…) follow
 * the selected theme without per-component changes.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const style = useMemo(() => vars(paletteToVars(colors)), [colors]);
  return (
    <View style={[{ flex: 1, backgroundColor: colors.white }, style]}>
      {children}
    </View>
  );
}

/** Pins a subtree to a fixed theme (e.g. surfaces designed for one palette). */
export function ThemeScope({ theme, children }: { theme: ThemeId; children: React.ReactNode }) {
  const style = useMemo(() => vars(paletteToVars(buildPalette(THEMES[theme], ACCENTS.mono))), [theme]);
  return <View style={style} pointerEvents="box-none">{children}</View>;
}

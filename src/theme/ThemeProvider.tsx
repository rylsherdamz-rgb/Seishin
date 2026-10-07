import { useMemo } from "react";
import { View, useColorScheme } from "react-native";
import { vars } from "nativewind";
import { useThemeStore } from "@/stores/theme-store";
import { ACCENTS, THEMES, buildPalette, paletteToVars, type Palette, type ThemeDef, type ThemeId } from "./themes";

export interface ResolvedTheme {
  theme: ThemeDef;
  colors: Palette;
  dark: boolean;
}

/** Live theme: hex palette for props that can't take a className. */
export function useTheme(): ResolvedTheme {
  const mode = useThemeStore((s) => s.mode);
  const accentId = useThemeStore((s) => s.accent);
  const scheme = useColorScheme();
  return useMemo(() => {
    const id = mode === "system" ? (scheme === "dark" ? "dark" : "light") : mode;
    const theme = THEMES[id];
    return { theme, colors: buildPalette(theme, ACCENTS[accentId]), dark: theme.dark };
  }, [mode, accentId, scheme]);
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

/**
 * Seishin theme tokens.
 *
 * The app is styled with semantic ink tokens (`bg-white`, `text-black`,
 * `bg-ink-100`, …). Each token is backed by a CSS variable (see
 * `tailwind.config.js` + `global.css`), so swapping a theme only swaps the
 * variable values — every NativeWind class re-themes automatically.
 *
 * "black" means *foreground ink* and "white" means *page background*; dark
 * themes simply invert them. Hex values are exposed for props that can't
 * take a className (icon colors, placeholders, native options).
 */

export type InkToken =
  | "black" | "900" | "800" | "700" | "600" | "500" | "400" | "300"
  | "200" | "150" | "100" | "75" | "50" | "25" | "white";

export type ThemeId = "light" | "dark" | "paper" | "midnight" | "amoled";
export type ThemeMode = ThemeId | "system";
export type AccentId = "mono" | "blue" | "green" | "violet" | "orange" | "rose";

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  dark: boolean;
  ink: Record<InkToken, string>;
}

export interface AccentDef {
  id: AccentId;
  name: string;
  /** Accent on light themes / on dark themes. `null` = follow the ink (monochrome). */
  light: string | null;
  dark: string | null;
}

/** Flat hex palette consumed by `useTheme()`. */
export interface Palette {
  black: string;
  ink900: string;
  ink800: string;
  ink700: string;
  ink600: string;
  ink500: string;
  ink400: string;
  ink300: string;
  ink200: string;
  ink150: string;
  ink100: string;
  ink75: string;
  ink50: string;
  ink25: string;
  white: string;
  accent: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  success: string;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  light: {
    id: "light",
    name: "Mono Light",
    description: "Classic black ink on white",
    dark: false,
    ink: {
      black: "#000000", "900": "#1a1a1a", "800": "#262626", "700": "#333333",
      "600": "#4d4d4d", "500": "#666666", "400": "#808080", "300": "#999999",
      "200": "#cccccc", "150": "#dcdcdc", "100": "#e5e5e5", "75": "#eeeeee",
      "50": "#f2f2f2", "25": "#f8f8f8", white: "#ffffff",
    },
  },
  paper: {
    id: "paper",
    name: "Paper",
    description: "Warm, low-glare cream",
    dark: false,
    ink: {
      black: "#1c1917", "900": "#292524", "800": "#33302d", "700": "#44403c",
      "600": "#57534e", "500": "#6f6a64", "400": "#857f78", "300": "#a29c94",
      "200": "#d1cbc2", "150": "#ddd7ce", "100": "#e8e2d8", "75": "#efeae1",
      "50": "#f3eee6", "25": "#f7f3ec", white: "#fbf8f3",
    },
  },
  dark: {
    id: "dark",
    name: "Mono Dark",
    description: "Soft white ink on charcoal",
    dark: true,
    ink: {
      black: "#f5f5f5", "900": "#e8e8e8", "800": "#d4d4d4", "700": "#bdbdbd",
      "600": "#a3a3a3", "500": "#8c8c8c", "400": "#737373", "300": "#5e5e5e",
      "200": "#404040", "150": "#363636", "100": "#2b2b2b", "75": "#242424",
      "50": "#1e1e1e", "25": "#181818", white: "#111111",
    },
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    description: "Deep navy for late nights",
    dark: true,
    ink: {
      black: "#e8ecf5", "900": "#dbe1ee", "800": "#c7cfe0", "700": "#aeb8cd",
      "600": "#949fb8", "500": "#7d88a1", "400": "#667089", "300": "#525b72",
      "200": "#363e52", "150": "#2e3547", "100": "#252c3d", "75": "#1f2535",
      "50": "#1a2030", "25": "#151a28", white: "#0f1320",
    },
  },
  amoled: {
    id: "amoled",
    name: "AMOLED",
    description: "True black, saves battery",
    dark: true,
    ink: {
      black: "#ffffff", "900": "#ededed", "800": "#d9d9d9", "700": "#c2c2c2",
      "600": "#a6a6a6", "500": "#8a8a8a", "400": "#6e6e6e", "300": "#575757",
      "200": "#333333", "150": "#292929", "100": "#1f1f1f", "75": "#171717",
      "50": "#121212", "25": "#0a0a0a", white: "#000000",
    },
  },
};

export const THEME_ORDER: ThemeId[] = ["light", "paper", "dark", "midnight", "amoled"];

export const ACCENTS: Record<AccentId, AccentDef> = {
  mono: { id: "mono", name: "Ink", light: null, dark: null },
  blue: { id: "blue", name: "Blue", light: "#2563eb", dark: "#60a5fa" },
  green: { id: "green", name: "Green", light: "#16a34a", dark: "#4ade80" },
  violet: { id: "violet", name: "Violet", light: "#7c3aed", dark: "#a78bfa" },
  orange: { id: "orange", name: "Orange", light: "#ea580c", dark: "#fb923c" },
  rose: { id: "rose", name: "Rose", light: "#e11d48", dark: "#fb7185" },
};

export const ACCENT_ORDER: AccentId[] = ["mono", "blue", "green", "violet", "orange", "rose"];

export function buildPalette(theme: ThemeDef, accent: AccentDef): Palette {
  const i = theme.ink;
  const accentHex = (theme.dark ? accent.dark : accent.light) ?? i.black;
  // Mono accent sits on the page color; colored accents carry their own contrast.
  const onAccent = accent.light === null ? i.white : theme.dark ? "#0b0b0b" : "#ffffff";
  return {
    black: i.black, ink900: i["900"], ink800: i["800"], ink700: i["700"],
    ink600: i["600"], ink500: i["500"], ink400: i["400"], ink300: i["300"],
    ink200: i["200"], ink150: i["150"], ink100: i["100"], ink75: i["75"],
    ink50: i["50"], ink25: i["25"], white: i.white,
    accent: accentHex,
    onAccent,
    danger: theme.dark ? "#ff453a" : "#ff3b30",
    dangerSoft: theme.dark ? "#3a1715" : "#ffeceb",
    success: "#2fbf71",
  };
}

/** "#rrggbb" → "r g b" (the channel format the CSS variables use). */
export function hexToChannels(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS variable map for NativeWind's `vars()`. */
export function paletteToVars(p: Palette): Record<string, string> {
  return {
    "--c-black": hexToChannels(p.black),
    "--c-ink-900": hexToChannels(p.ink900),
    "--c-ink-800": hexToChannels(p.ink800),
    "--c-ink-700": hexToChannels(p.ink700),
    "--c-ink-600": hexToChannels(p.ink600),
    "--c-ink-500": hexToChannels(p.ink500),
    "--c-ink-400": hexToChannels(p.ink400),
    "--c-ink-300": hexToChannels(p.ink300),
    "--c-ink-200": hexToChannels(p.ink200),
    "--c-ink-150": hexToChannels(p.ink150),
    "--c-ink-100": hexToChannels(p.ink100),
    "--c-ink-75": hexToChannels(p.ink75),
    "--c-ink-50": hexToChannels(p.ink50),
    "--c-ink-25": hexToChannels(p.ink25),
    "--c-white": hexToChannels(p.white),
    "--c-accent": hexToChannels(p.accent),
    "--c-on-accent": hexToChannels(p.onAccent),
    "--c-danger": hexToChannels(p.danger),
    "--c-danger-soft": hexToChannels(p.dangerSoft),
  };
}

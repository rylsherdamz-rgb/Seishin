/**
 * Note background colors — soft tonal surfaces in the spirit of Material 3.
 * Each color has a light-theme tone (pale, dark ink on top) and a dark-theme
 * tone (deep, light ink on top), so text keeps contrast whichever app theme is
 * active. "default" means: use the theme's own surface.
 */
export type NoteColorId =
  | "default" | "rose" | "apricot" | "lemon" | "mint" | "teal"
  | "sky" | "slate" | "lavender" | "blush" | "sand" | "stone";

export interface NoteColor {
  id: NoteColorId;
  name: string;
  light: string;
  dark: string;
}

export const NOTE_COLORS: NoteColor[] = [
  { id: "default", name: "Default", light: "", dark: "" },
  { id: "rose", name: "Rose", light: "#fbd5d1", dark: "#5c2430" },
  { id: "apricot", name: "Apricot", light: "#fbe0c4", dark: "#5e3418" },
  { id: "lemon", name: "Lemon", light: "#fbf2b8", dark: "#5a4a10" },
  { id: "mint", name: "Mint", light: "#dcf3d6", dark: "#21452f" },
  { id: "teal", name: "Teal", light: "#cdeae4", dark: "#174b48" },
  { id: "sky", name: "Sky", light: "#d7e9f6", dark: "#1d4560" },
  { id: "slate", name: "Slate", light: "#d9e0ea", dark: "#2c3747" },
  { id: "lavender", name: "Lavender", light: "#e6dcf5", dark: "#3e2d5a" },
  { id: "blush", name: "Blush", light: "#f6e1ea", dark: "#57303f" },
  { id: "sand", name: "Sand", light: "#ece3d3", dark: "#47402f" },
  { id: "stone", name: "Stone", light: "#e7e7e5", dark: "#2f3030" },
];

const BY_ID = new Map(NOTE_COLORS.map((c) => [c.id, c]));

export function isNoteColorId(x: unknown): x is NoteColorId {
  return typeof x === "string" && BY_ID.has(x as NoteColorId);
}

/** Background for a note in the current theme, or null for the default surface. */
export function noteBackground(id: string | undefined, dark: boolean): string | null {
  if (!id || id === "default") return null;
  const c = BY_ID.get(id as NoteColorId);
  if (!c) return null;
  return dark ? c.dark : c.light;
}

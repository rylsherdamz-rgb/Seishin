/**
 * Display preferences beyond theme + accent (clock, week start, text size,
 * density, start tab). Stored alongside the theme in `useThemeStore`.
 */
export type TimeFormat = "12h" | "24h";
/** 0 = Sunday, 1 = Monday. */
export type WeekStart = 0 | 1;
export type TextSize = "small" | "default" | "large" | "xlarge";
export type Density = "compact" | "default" | "comfortable";
export type StartTab = "index" | "notes" | "agent";

export const TIME_FORMATS: readonly TimeFormat[] = ["12h", "24h"];
export const TEXT_SIZES: readonly TextSize[] = ["small", "default", "large", "xlarge"];
export const DENSITIES: readonly Density[] = ["compact", "default", "comfortable"];
export const START_TABS: readonly StartTab[] = ["index", "notes", "agent"];

/** Multipliers applied to the Tailwind type scale / padding+gap (see tailwind.config.js). */
export const TEXT_SCALE: Record<TextSize, number> = { small: 0.9, default: 1, large: 1.12, xlarge: 1.25 };
export const DENSITY_SCALE: Record<Density, number> = { compact: 0.8, default: 1, comfortable: 1.15 };

/**
 * Deterministic time formatting (independent of the device's Intl support) so
 * the 12h/24h preference is always honored.
 */
export function formatTime(d: Date, format: TimeFormat): string {
  if (isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  if (format === "24h") return `${String(h).padStart(2, "0")}:${m}`;
  return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

/** `[0..6]` weekday indices (0 = Sunday) in display order for the given week start. */
export function weekdayOrder(weekStart: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
}

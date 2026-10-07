# ADR 0001 — Runtime theming via CSS variables

**Date:** 2026-10-07 · **Status:** Accepted

## Context
Users asked to change the app's look (dark mode, accent colors). Every screen
styles with NativeWind ink classes (`bg-white`, `text-black`, `bg-ink-100`), and
icons/native options used hardcoded hex values.

## Decision
- All Tailwind colors (`black`, `white`, `ink-*`, `accent`, `danger`) resolve to
  CSS variables (`rgb(var(--c-…) / <alpha-value>)`). Defaults live in `global.css`.
- `ThemeProvider` (src/theme) applies the active palette with NativeWind `vars()`
  at the root, so every class re-themes with no per-screen changes.
- Semantics: `black` = foreground ink, `white` = page background. Dark themes invert.
- Props that can't take classes (icon colors, placeholders, tab bar, sheets) read
  hex values from `useColors()` / `useTheme()`.
- Theme + accent persist in the `settings` MMKV instance under
  `settings:theme:mode` and `settings:theme:accent`.
- Default stays **Mono Light + Ink accent**, i.e. the original B&W design system.
  Colored accents are opt-in; `danger` remains reserved for destructive actions.

## Consequences
- New UI must use ink/accent classes or `useColors()` — never raw hex.
- Surfaces designed for a fixed palette (alarm overlay) wrap in `<ThemeScope theme="light">`.

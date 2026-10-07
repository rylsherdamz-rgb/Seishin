const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Every color is a CSS variable so themes can swap them at runtime
      // (see src/theme/themes.ts). "black" = foreground ink, "white" = page.
      colors: {
        black: v("black"),
        white: v("white"),
        ink: {
          black: v("black"),
          900: v("ink-900"),
          800: v("ink-800"),
          700: v("ink-700"),
          600: v("ink-600"),
          500: v("ink-500"),
          400: v("ink-400"),
          300: v("ink-300"),
          200: v("ink-200"),
          150: v("ink-150"),
          100: v("ink-100"),
          75: v("ink-75"),
          50: v("ink-50"),
          25: v("ink-25"),
          white: v("white"),
        },
        // User-selectable accent ("Ink" = monochrome, the default).
        accent: {
          DEFAULT: v("accent"),
          on: v("on-accent"),
        },
        // Reserved for destructive actions per the design system.
        danger: {
          DEFAULT: v("danger"),
          soft: v("danger-soft"),
        },
        // Neutral status affordance (e.g. "service active").
        success: {
          DEFAULT: "#2fbf71",
        },
      },
      // Soft, monochrome elevation. Shadows stay black-tinted so the
      // palette remains strictly B&W while gaining depth.
      boxShadow: {
        // Barely-there lift for chips, inputs, and small controls.
        subtle: "0px 1px 2px rgba(0, 0, 0, 0.06)",
        // Default card / surface elevation.
        card: "0px 2px 8px rgba(0, 0, 0, 0.06)",
        // Raised interactive surfaces (primary buttons, active chips).
        raised: "0px 4px 12px rgba(0, 0, 0, 0.10)",
        // Floating elements: FAB, bottom sheets, modals.
        float: "0px 8px 24px rgba(0, 0, 0, 0.14)",
      },
      borderRadius: {
        // Design system: 0 (default) or 8 (cards/modals); extend with a
        // slightly larger, softer radius for hero surfaces + pills.
        card: "12px",
        sheet: "20px",
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
    },
  },
  plugins: [],
};

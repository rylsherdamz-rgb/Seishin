/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: {
          black: "#000000",
          900: "#1a1a1a",
          800: "#262626",
          700: "#333333",
          600: "#4d4d4d",
          500: "#666666",
          400: "#808080",
          300: "#999999",
          200: "#cccccc",
          150: "#dcdcdc",
          100: "#e5e5e5",
          75: "#eeeeee",
          50: "#f2f2f2",
          25: "#f8f8f8",
          white: "#ffffff",
        },
        // Sole accent, reserved for destructive actions per the design system.
        danger: {
          DEFAULT: "#ff3b30",
          soft: "#ffeceb",
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

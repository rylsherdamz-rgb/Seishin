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
          100: "#e5e5e5",
          50: "#f2f2f2",
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
    },
  },
  plugins: [],
};

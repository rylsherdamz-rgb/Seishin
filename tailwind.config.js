/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          black: "#000000",
          900: "#1a1a1a",
          700: "#333333",
          500: "#666666",
          300: "#999999",
          200: "#cccccc",
          100: "#e5e5e5",
          white: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};

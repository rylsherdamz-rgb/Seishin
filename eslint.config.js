// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*", "coverage/*", "store/*", "scripts/widget-previews/*"],
  },
  {
    rules: {
      // RULES.md: no console in production code; src/utils/logger.ts is the one way out.
      "no-console": "error",
      // React Compiler rules: Seishin doesn't run the compiler, and these flag
      // ordinary RN patterns (Animated.Value refs, Reanimated shared values).
      // Kept visible, not blocking.
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      // HTML-only concern; quotes inside RN <Text> render as-is.
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["src/utils/logger.ts", "scripts/**", "plugins/**", "**/__tests__/**", "**/__mocks__/**", "jest.setup.js", "*.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { "no-console": "off" },
  },
  {
    // Test doubles define forwardRef components inline.
    files: ["**/__tests__/**", "**/__mocks__/**"],
    rules: { "react-hooks/rules-of-hooks": "off", "react/display-name": "off" },
  },
]);

/** @type {import('jest').Config} */
module.exports = {
  preset: "react-native",
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@expo|expo-.*|react-native-.*|youtubei\\.js|uuid|llama\\.rn)/)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^expo-file-system$": "<rootDir>/src/__mocks__/expo-file-system.ts",
    "^expo-file-system/legacy$": "<rootDir>/src/__mocks__/expo-file-system-legacy.ts",
    "^expo-document-picker$": "<rootDir>/src/__mocks__/expo-document-picker.ts",
    "^expo-constants$": "<rootDir>/src/__mocks__/expo-constants.ts",
    "^expo-clipboard$": "<rootDir>/src/__mocks__/expo-clipboard.ts",
    "^expo-audio$": "<rootDir>/src/__mocks__/expo-audio.ts",
    "^expo-camera$": "<rootDir>/src/__mocks__/expo-camera.ts",
    "^react-native-mmkv$": "<rootDir>/src/__mocks__/react-native-mmkv.ts",
    "^openai$": "<rootDir>/src/__mocks__/openai.ts",
    "^llama\\.rn$": "<rootDir>/src/__mocks__/llama-rn.ts",
  },
  transform: {
    "^.+\\.tsx?$": "babel-jest",
    "^.+\\.mjs$": "babel-jest",
  },
};

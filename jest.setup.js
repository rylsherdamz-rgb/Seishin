/* Shared Jest mocks for native-only modules used by screens. */
jest.mock("react-native-reanimated", () => require("./src/__mocks__/reanimated"));

jest.mock("@expo/vector-icons/Feather", () => require("./src/__mocks__/icon"));
jest.mock("@expo/vector-icons/Ionicons", () => require("./src/__mocks__/icon"));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { Image: (props) => React.createElement(View, props) };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const Box = (props) => React.createElement(View, props);
  return {
    __esModule: true,
    SafeAreaView: Box,
    SafeAreaProvider: Box,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    getItemAsync: async (k) => store.get(k) ?? null,
    setItemAsync: async (k, v) => { store.set(k, v); },
    deleteItemAsync: async (k) => { store.delete(k); },
  };
});

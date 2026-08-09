import React from "react";
import { create, act } from "react-test-renderer";
import { TextInput, TouchableOpacity } from "react-native";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { HIGH: 4 },
}));

jest.mock("expo-android-notification-listener-service", () => ({
  __esModule: true,
  default: {
    isNotificationPermissionGranted: jest.fn(() => true),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    openNotificationListenerSettings: jest.fn(),
  },
}));

jest.mock("react-native-safe-area-context", () => {
  const ReactMod = require("react");
  const { View } = require("react-native");
  const SafeAreaView = (props: Record<string, unknown>) =>
    ReactMod.createElement(View, props);
  SafeAreaView.displayName = "SafeAreaView";
  return {
    __esModule: true,
    SafeAreaView,
    SafeAreaProvider: (props: Record<string, unknown>) =>
      ReactMod.createElement(View, props),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

jest.mock("expo-router", () => {
  const ReactMod = require("react");
  const Stack = (props: Record<string, unknown>) =>
    ReactMod.createElement(ReactMod.Fragment, null, props.children);
  Stack.displayName = "Stack";
  Stack.Screen = () => null;
  return {
    Stack,
    router: { push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void) => {
      ReactMod.useEffect(() => { cb(); }, []);
    },
  };
});

jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("@/services/ocr", () => ({
  recognizeText: jest.fn(),
}));

jest.mock("@/services/youtube-summary", () => ({
  extractVideoId: jest.fn(() => null),
  getTranscript: jest.fn(),
  summarizeTranscript: jest.fn(),
  downloadThumbnail: jest.fn(),
}));

jest.mock("@expo/ui/community/bottom-sheet", () => {
  const ReactMod = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactMod.createElement(View, props),
    BottomSheetView: (props: Record<string, unknown>) =>
      ReactMod.createElement(View, props),
  };
});

jest.mock("@expo/vector-icons/Feather", () => {
  const ReactMod = require("react");
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      ReactMod.createElement(Text, props, "·"),
  };
});

import NoteEditorScreen from "../../app/note";
import { useNotesStore } from "@/stores/notes-store";
import Feather from "@expo/vector-icons/Feather";

function findBodyInput(tree: ReturnType<typeof create>) {
  const inputs = tree.root.findAllByType(TextInput);
  const body = inputs.find((i) =>
    String(i.props.placeholder ?? "").includes("Start writing"),
  );
  if (!body) throw new Error("body input not found");
  return body;
}

function findPinButton(tree: ReturnType<typeof create>) {
  const buttons = tree.root.findAllByType(TouchableOpacity);
  const pin = buttons.find((b) =>
    b.findAllByType(Feather).some((f) => f.props.name === "bookmark"),
  );
  if (!pin) throw new Error("pin button not found");
  return pin;
}

describe("NoteEditorScreen", () => {
  test("typing a new memo creates it; pin + back keeps it in the store", () => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(<NoteEditorScreen />);
    });

    act(() => {
      findBodyInput(tree as unknown as ReturnType<typeof create>).props.onChangeText("hello world");
    });

    let notes = useNotesStore.getState().notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe("hello world");
    expect(notes[0].pinned).toBe(false);

    act(() => {
      findPinButton(tree as unknown as ReturnType<typeof create>).props.onPress();
    });
    notes = useNotesStore.getState().notes;
    expect(notes[0].pinned).toBe(true);

    act(() => {
      tree?.unmount();
    });
    notes = useNotesStore.getState().notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe("hello world");
    expect(notes[0].pinned).toBe(true);
  });
});
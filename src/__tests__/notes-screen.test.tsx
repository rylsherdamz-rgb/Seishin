import React from "react";
import { create, act } from "react-test-renderer";

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

jest.mock("expo-router", () => {
  const ReactMod = require("react");
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useFocusEffect: (cb: () => void) => {
      ReactMod.useEffect(() => { cb(); }, []);
    },
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

import NotesScreen from "../../app/(tabs)/notes";
import { useNotesStore } from "@/stores/notes-store";
import { notesStorage } from "@/stores/mmkv";
import { useInboxStore } from "@/stores/inbox-store";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

function seedData() {
  const now = new Date().toISOString();
  useNotesStore.getState().addNote({
    id: "n1",
    title: "Meeting notes",
    body: "Talked about the roadmap.",
    tags: ["work"],
    pinned: true,
    attachments: [
      { id: "a1", type: "image", uri: "file:///tmp/photo.jpg", name: "photo.jpg" },
      { id: "a2", type: "file", uri: "file:///tmp/sheet.xlsx", name: "sheet.xlsx" },
    ],
    createdAt: now,
    updatedAt: now,
  });
  useNotesStore.getState().addNote({
    id: "n2",
    title: "Grocery list",
    body: "Milk, eggs, bread.",
    tags: [],
    pinned: false,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  });
  useInboxStore.getState().addItem({
    id: "i1",
    type: "notification",
    title: "Upcoming Event",
    body: "Dentist appointment",
    timestamp: now,
    source: "Seishin",
    read: false,
  });
}

describe("NotesScreen render", () => {
  test("renders notes tab with seeded notes (incl. image attachment)", () => {
    seedData();
    let tree: ReturnType<typeof create> | undefined;
    expect(() => {
      act(() => {
        tree = create(<NotesScreen />);
      });
    }).not.toThrow();
    tree?.unmount();
  });

  test("switching to Inbox tab renders inbox items without crashing", () => {
    seedData();
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(<NotesScreen />);
    });
    const segmented = tree?.root.findByType(SegmentedControl);
    expect(segmented).toBeTruthy();
    expect(() => {
      act(() => {
        segmented?.props.onChange("inbox");
      });
    }).not.toThrow();
    tree?.unmount();
  });

  test("renders with empty stores without crashing", () => {
    let tree: ReturnType<typeof create> | undefined;
    expect(() => {
      act(() => {
        tree = create(<NotesScreen />);
      });
    }).not.toThrow();
    tree?.unmount();
  });

  test("renders notes loaded from storage with legacy/malformed shapes", () => {
    notesStorage.set(
      "notes",
      JSON.stringify([
        { id: "old1", body: "no title, tags, attachments or dates" },
        { id: "old2", title: "Partially filled", pinned: "yes", tags: "work" },
      ]),
    );
    useNotesStore.getState().loadNotes();
    let tree: ReturnType<typeof create> | undefined;
    expect(() => {
      act(() => {
        tree = create(<NotesScreen />);
      });
    }).not.toThrow();
    const notes = useNotesStore.getState().notes;
    expect(notes).toHaveLength(2);
    expect(notes[0].tags).toEqual([]);
    expect(notes[0].attachments).toEqual([]);
    expect(notes[0].pinned).toBe(false);
    expect(typeof notes[0].updatedAt).toBe("string");
    tree?.unmount();
  });

  test("notes loaded after mount appear in the grid (no stale memo)", () => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(<NotesScreen />);
    });
    expect(tree?.root.findAll((n) => n.props.children === "Late note")).toHaveLength(0);
    const now = new Date().toISOString();
    act(() => {
      useNotesStore.getState().addNote({
        id: "late1",
        title: "Late note",
        body: "added after mount",
        tags: [],
        pinned: false,
        attachments: [],
        createdAt: now,
        updatedAt: now,
      });
    });
    const found = tree?.root.findAll((n) => n.props.children === "Late note");
    expect(found?.length).toBeGreaterThan(0);
    tree?.unmount();
  });
});

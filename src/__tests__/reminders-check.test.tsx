/**
 * RemindersCheck shows the "allow alarms" rows only when the native module
 * says the matching Android switch is off, and opens the right system page.
 */
import React from "react";
import { Platform, Text } from "react-native";
import TestRenderer, { act } from "react-test-renderer";

const mockOpen = jest.fn();
let mockAccess = { exact: true, fullScreen: true };

jest.mock("@/services/notify-core", () => ({
  REMINDER_CHANNEL: "event-reminders",
  ensureEventChannels: jest.fn(),
  ensureNotificationPermission: jest.fn(async () => true),
  NativeAlarm: {
    alarmAccess: jest.fn(async () => mockAccess),
    openAlarmAccess: (kind: string) => mockOpen(kind),
  },
}));
jest.mock("@/theme/ThemeProvider", () => ({ useColors: () => ({ black: "#000", ink300: "#999" }) }));
jest.mock("@expo/vector-icons/Feather", () => "Feather");
jest.mock("expo-notifications", () => ({ scheduleNotificationAsync: jest.fn(), SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" } }));

import { RemindersCheck } from "@/components/settings/RemindersCheck";

async function render() {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(<RemindersCheck />);
  });
  const labels = tree.root.findAllByType(Text).map((t) => String(t.props.children));
  return { tree, labels };
}

beforeAll(() => {
  Platform.OS = "android";
});
beforeEach(() => mockOpen.mockClear());

it("hides the access rows when everything is allowed", async () => {
  mockAccess = { exact: true, fullScreen: true };
  const { labels } = await render();
  expect(labels).not.toContain("Allow alarms & reminders");
  expect(labels).not.toContain("Allow full-screen alarms");
});

it("shows a row per missing switch and opens its settings page", async () => {
  mockAccess = { exact: false, fullScreen: false };
  const { tree, labels } = await render();
  expect(labels).toContain("Allow alarms & reminders");
  expect(labels).toContain("Allow full-screen alarms");

  const row = tree.root.findAll((n) => typeof n.props.onPress === "function" && n.findAllByType(Text).some((t) => t.props.children === "Allow full-screen alarms"))[0];
  act(() => row.props.onPress());
  expect(mockOpen).toHaveBeenCalledWith("fullScreen");
});

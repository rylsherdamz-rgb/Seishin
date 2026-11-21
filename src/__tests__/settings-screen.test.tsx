/**
 * Settings after the split into section components: every section renders,
 * the build version shows, and destructive actions confirm with the right words.
 */
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { create, act, type ReactTestRenderer } from "react-test-renderer";

jest.mock("expo-application", () => ({ nativeApplicationVersion: "1.0.0", nativeBuildVersion: "7" }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@expo/vector-icons/Feather", () => "Feather");
jest.mock("@/theme/ThemeProvider", () => ({ useColors: () => new Proxy({}, { get: () => "#000" }) }));
jest.mock("@/hooks/useKeyboardPadding", () => ({ useKeyboardPadding: () => 0 }));
// Sections with their own native deps and tests: stand-ins here.
jest.mock("@/components/AppearancePicker", () => ({ AppearancePicker: () => null }));
jest.mock("@/components/settings/DisplayControls", () => ({ DisplayControls: () => null }));
jest.mock("@/components/BackupSection", () => ({ BackupSection: () => null }));
jest.mock("@/components/settings/WidgetsSection", () => ({ WidgetsSection: () => null }));
jest.mock("@/components/settings/RemindersCheck", () => ({ RemindersCheck: () => null }));
jest.mock("@/components/ui/Sheet", () => ({ Sheet: () => null }));
jest.mock("@/services/notification-service", () => ({ pickAlarmRingtone: jest.fn(), applyAlarmRingtone: jest.fn() }));
jest.mock("@/services/nim-models", () => ({ fetchNimModels: jest.fn(), fetchAllNimModels: jest.fn(async () => []), cacheNimModels: jest.fn() }));
jest.mock("@/services/notify-core", () => ({ NativeAlarm: undefined }));
jest.mock("@/services/factory-reset", () => ({ factoryReset: jest.fn(async () => ({ ok: true, failed: [] })) }));
jest.mock("@/stores/settings-store", () => {
  const state = {
    loadSettings: jest.fn(), apiKeys: { nim: "" }, nimEndpoint: "", nimModel: "", modelPath: null,
    alarmRingtoneUri: null, alarmRingtoneName: "Default alarm sound",
    setApiKey: jest.fn(), setNimEndpoint: jest.fn(), setNimModel: jest.fn(), setModelPath: jest.fn(), setAlarmRingtone: jest.fn(),
  };
  return { useSettingsStore: (sel: (s: typeof state) => unknown) => sel(state) };
});

import SettingsScreen from "../../app/(tabs)/settings";

const texts = (t: ReactTestRenderer) => t.root.findAllByType(Text).map((n) => [n.props.children].flat().join(""));
const press = (t: ReactTestRenderer, label: string) => {
  const btn = t.root.findAllByType(TouchableOpacity).find((b) => b.findAllByType(Text).some((x) => [x.props.children].flat().join("") === label));
  if (!btn) throw new Error(`no button "${label}"`);
  act(() => btn.props.onPress());
};

let tree: ReactTestRenderer;
beforeEach(async () => {
  await act(async () => { tree = create(<SettingsScreen />); });
});

it("renders every section and the build version", () => {
  const all = texts(tree);
  for (const s of ["Appearance", "AI Configuration", "Reminders", "Backup & restore", "Storage", "About"]) expect(all).toContain(s);
  expect(all).toContain("v1.0.0 (7)");
  expect(all.join(" ")).not.toMatch(/notifications/i); // connector subtitle no longer advertises the removed listener
});

it("factory reset asks with a destructive 'Delete everything' button", () => {
  press(tree, "Factory reset — delete everything");
  expect(texts(tree)).toContain("Delete everything");
});

it("clearing a store says how many items go", () => {
  press(tree, "Data Storage");
  press(tree, "Clear");
  expect(texts(tree).some((t) => /^Deletes \d+ items?\. This can't be undone\.$/.test(t))).toBe(true);
});

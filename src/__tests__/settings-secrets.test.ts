type SecureStoreMod = typeof import("expo-secure-store");

// The NIM key must never sit in MMKV as plain text (RULES: storage #8).
describe("NIM key storage", () => {
  // Fresh module graph per test; grab the mocks from the same graph as the store.
  let settingsStorage: typeof import("@/stores/mmkv")["settingsStorage"];
  let SecureStore: SecureStoreMod;
  beforeEach(() => {
    jest.resetModules();
    settingsStorage = require("@/stores/mmkv").settingsStorage;
    SecureStore = require("expo-secure-store");
    settingsStorage.clearAll();
  });

  const load = () => require("@/stores/settings-store") as typeof import("@/stores/settings-store");

  it("moves a legacy plain-text key into SecureStore and wipes the MMKV copy", async () => {
    settingsStorage.set("apiKeys", JSON.stringify({ nim: "nvapi-legacy" }));
    const { getNimKey } = load();
    expect(await getNimKey()).toBe("nvapi-legacy");
    expect(settingsStorage.getString("apiKeys")).toBeNull();
    expect(await SecureStore.getItemAsync("seishin.nim.token")).toBe("nvapi-legacy");
  });

  it("writes new keys to SecureStore only", async () => {
    const { useSettingsStore, getNimKey } = load();
    await getNimKey();
    useSettingsStore.getState().setApiKey("nim", "  nvapi-new  ");
    expect(useSettingsStore.getState().apiKeys.nim).toBe("nvapi-new");
    await new Promise((r) => setTimeout(r, 0));
    expect(await SecureStore.getItemAsync("seishin.nim.token")).toBe("nvapi-new");
    expect(settingsStorage.getAllKeys()).not.toContain("apiKeys");
  });

  it("survives corrupt settings JSON", () => {
    settingsStorage.set("cleanupPolicies", "{not json");
    const { useSettingsStore } = load();
    expect(useSettingsStore.getState().cleanupPolicies.chatDays).toBe(90);
  });
});

import * as SecureStore from "expo-secure-store";
import { createLogger } from "@/utils/logger";

const log = createLogger("secrets");

/**
 * Connector tokens live in the Android Keystore / iOS Keychain via
 * expo-secure-store — never in MMKV (RULES: no secrets without encryption).
 */
const key = (name: string) => `seishin.${name}.token`;

export async function getToken(name: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key(name));
  } catch (e) {
    log.warn("read failed", name, e);
    return null;
  }
}

export async function setToken(name: string, value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key(name), value.trim());
    return true;
  } catch (e) {
    log.error("write failed", name, e);
    return false;
  }
}

export async function deleteToken(name: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key(name));
  } catch {
    // Already gone.
  }
}

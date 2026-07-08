import { MMKV } from "react-native-mmkv";

export const eventsStorage = new MMKV({ id: "events" });
export const messagesStorage = new MMKV({ id: "messages" });
export const emailsStorage = new MMKV({ id: "emails" });
export const notificationsStorage = new MMKV({ id: "notifications" });
export const agentStorage = new MMKV({ id: "agent" });
export const settingsStorage = new MMKV({ id: "settings" });
export const ocrStorage = new MMKV({ id: "ocr" });

export function clearAllStorage() {
  eventsStorage.clearAll();
  messagesStorage.clearAll();
  emailsStorage.clearAll();
  notificationsStorage.clearAll();
  agentStorage.clearAll();
  settingsStorage.clearAll();
  ocrStorage.clearAll();
}

export function getStorageSizes(): Record<string, number> {
  return {
    events: eventsStorage.getAllKeys().length,
    messages: messagesStorage.getAllKeys().length,
    emails: emailsStorage.getAllKeys().length,
    notifications: notificationsStorage.getAllKeys().length,
    agent: agentStorage.getAllKeys().length,
    settings: settingsStorage.getAllKeys().length,
    ocr: ocrStorage.getAllKeys().length,
  };
}

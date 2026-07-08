import { createMMKV } from "react-native-mmkv";

export const eventsStorage = createMMKV({ id: "events" });
export const messagesStorage = createMMKV({ id: "messages" });
export const emailsStorage = createMMKV({ id: "emails" });
export const notificationsStorage = createMMKV({ id: "notifications" });
export const agentStorage = createMMKV({ id: "agent" });
export const settingsStorage = createMMKV({ id: "settings" });
export const ocrStorage = createMMKV({ id: "ocr" });
export const todosStorage = createMMKV({ id: "todos" });
export const invitesStorage = createMMKV({ id: "invites" });

export function clearAllStorage() {
  eventsStorage.clearAll();
  messagesStorage.clearAll();
  emailsStorage.clearAll();
  notificationsStorage.clearAll();
  agentStorage.clearAll();
  settingsStorage.clearAll();
  ocrStorage.clearAll();
  todosStorage.clearAll();
  invitesStorage.clearAll();
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
    todos: todosStorage.getAllKeys().length,
    invites: invitesStorage.getAllKeys().length,
  };
}

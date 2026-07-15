import { NativeModules, NativeEventEmitter, Platform, Linking } from "react-native";

const { NotificationBridge } = NativeModules;

export interface PhoneNotification {
  app: string;
  title: string;
  text: string;
  timestamp: number;
  key: string;
}

type Listener = (notification: PhoneNotification) => void;

const listeners = new Set<Listener>();
let emitter: NativeEventEmitter | null = null;

function getEmitter() {
  if (emitter) return emitter;
  if (NotificationBridge) {
    emitter = new NativeEventEmitter(NotificationBridge);
  }
  return emitter;
}

export function onNotificationReceived(listener: Listener) {
  listeners.add(listener);

  const e = getEmitter();
  const subscription = e?.addListener("onNotificationReceived", (data: any) => {
    const notif: PhoneNotification = {
      app: data.app ?? "",
      title: data.title ?? "",
      text: data.text ?? "",
      timestamp: data.timestamp ?? 0,
      key: data.key ?? "",
    };
    for (const fn of listeners) fn(notif);
  });

  return () => {
    listeners.delete(listener);
    subscription?.remove();
  };
}

export function isNotificationListenerAvailable(): boolean {
  return Platform.OS === "android" && NotificationBridge != null;
}

export function openNotificationAccessSettings() {
  if (Platform.OS === "android") {
    Linking.openSettings();
  }
}

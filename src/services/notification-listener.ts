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

let emitter: NativeEventEmitter | null = null;

function getEmitter() {
  if (emitter) return emitter;
  if (NotificationBridge) {
    emitter = new NativeEventEmitter(NotificationBridge);
  }
  return emitter;
}

export function onNotificationReceived(listener: Listener) {
  const e = getEmitter();
  // Each caller owns one native subscription and receives each event once.
  const subscription = e?.addListener("onNotificationReceived", (raw: unknown) => {
    const data = (raw ?? {}) as Partial<Record<keyof PhoneNotification, unknown>>;
    listener({
      app: typeof data.app === "string" ? data.app : "",
      title: typeof data.title === "string" ? data.title : "",
      text: typeof data.text === "string" ? data.text : "",
      timestamp: typeof data.timestamp === "number" ? data.timestamp : 0,
      key: typeof data.key === "string" ? data.key : "",
    });
  });

  return () => {
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

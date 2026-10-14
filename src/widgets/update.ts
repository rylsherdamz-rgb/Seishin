/**
 * Redraw every placed home-screen widget from current data. Called after
 * syncs and (debounced) whenever events or tasks change. No-op off Android
 * and on builds without the widget module.
 */
import { Platform } from "react-native";
import { createLogger } from "@/utils/logger";

const log = createLogger("widgets");

export async function updateWidgets(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const { requestWidgetUpdate } = require("react-native-android-widget") as typeof import("react-native-android-widget");
    const { WIDGET_NAMES, renderSeishinWidget } = require("./render") as typeof import("./render");
    await Promise.all(
      WIDGET_NAMES.map((name) => requestWidgetUpdate({ widgetName: name, renderWidget: (info) => renderSeishinWidget(name, info.widgetId) })),
    );
  } catch (e) {
    log.warn("widget update skipped", e);
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Coalesce bursts of edits into one redraw. */
export function updateWidgetsSoon(delayMs = 1500): void {
  if (Platform.OS !== "android") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    updateWidgets();
  }, delayMs);
}

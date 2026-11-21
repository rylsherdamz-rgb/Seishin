import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useThemeStore } from "@/stores/theme-store";
import { updateWidgets, updateWidgetsSoon } from "@/widgets/update";

/** While Seishin is on screen, pull from every connector this often. */
export const LIVE_INTERVAL = 60000;
/** Coalesces an app-switch burst (inactive → active → …) into one sync. */
const FOREGROUND_GAP = 15000;
const EDIT_DEBOUNCE = 1500;
const TODO_WIDGET_DELAY = 4000;

/**
 * Keeps every connector in sync without the user thinking about it:
 * full sync on launch and every time the app comes back, every minute while
 * it stays open, a light push ~1.5 s after any edit, and the OS background
 * task (Android's 15-min floor) while it is closed.
 */
export function useAutoSync() {
  const last = useRef(0);

  useEffect(() => {
    const sync = async (reason: string, light = false) => {
      const { syncEverything } = await import("@/services/connectors/sync-all");
      if (!light) last.current = Date.now();
      await syncEverything(reason, { light });
    };
    import("@/services/background-sync").then((m) => m.registerBackgroundSync()).catch(() => {});
    sync("launch");

    let live: ReturnType<typeof setInterval> | null = null;
    const startLive = () => {
      if (!live) live = setInterval(() => sync("live"), LIVE_INTERVAL);
    };
    const stopLive = () => {
      if (live) clearInterval(live);
      live = null;
    };
    startLive();

    const sub = AppState.addEventListener("change", (s) => {
      // Leaving the app: make sure the home screen shows the latest.
      if (s === "background") updateWidgets();
      if (s !== "active") return stopLive();
      if (Date.now() - last.current > FOREGROUND_GAP) sync("foreground");
      startLive();
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const pushSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => sync("edit", true), EDIT_DEBOUNCE);
    };
    // Imports touch only "calendar"/"feed" events; ignore those to avoid ping-pong.
    const own = (list: ReturnType<typeof useCalendarStore.getState>["events"]) => list.filter((e) => e.source !== "calendar" && e.source !== "feed");
    const unsubEvents = useCalendarStore.subscribe((s, prev) => {
      if (s.events === prev.events) return;
      updateWidgetsSoon();
      const a = own(s.events);
      const b = own(prev.events);
      if (a.length !== b.length || a.some((e, i) => e !== b[i])) pushSoon();
    });
    const unsubTodos = useTodoStore.subscribe((s, prev) => {
      if (s.todos === prev.todos) return;
      pushSoon();
      // Longer than events: adding several tasks in a row shouldn't redraw widgets between them.
      updateWidgetsSoon(TODO_WIDGET_DELAY);
    });
    const unsubTheme = useThemeStore.subscribe((s, prev) => {
      if (s.mode !== prev.mode || s.accent !== prev.accent) updateWidgetsSoon(300);
    });

    return () => {
      sub.remove();
      stopLive();
      unsubEvents();
      unsubTodos();
      unsubTheme();
      if (timer) clearTimeout(timer);
    };
  }, []);
}

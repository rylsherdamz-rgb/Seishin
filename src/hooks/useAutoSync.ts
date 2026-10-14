import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useThemeStore } from "@/stores/theme-store";
import { updateWidgets, updateWidgetsSoon } from "@/widgets/update";

const FOREGROUND_GAP = 10 * 60000;
const LOCAL_GAP = 45000;
const EDIT_DEBOUNCE = 8000;

/**
 * Keeps every connector in sync without the user thinking about it:
 * full sync on launch (and registers the ~30-min background task), again when
 * the app returns after 10+ minutes, and a light push shortly after edits —
 * so completing a task updates Google Calendar / Todoist / Notion quickly.
 */
export function useAutoSync() {
  const last = useRef(0);
  const lastLocal = useRef(0);

  useEffect(() => {
    const sync = async (reason: string, light = false, local = false) => {
      const { syncEverything } = await import("@/services/connectors/sync-all");
      if (!light && !local) last.current = Date.now();
      lastLocal.current = Date.now();
      await syncEverything(reason, { light, local });
    };
    import("@/services/background-sync").then((m) => m.registerBackgroundSync()).catch(() => {});
    sync("launch");

    const sub = AppState.addEventListener("change", (s) => {
      // Leaving the app: make sure the home screen shows the latest.
      if (s === "background") updateWidgets();
      if (s !== "active") return;
      if (Date.now() - last.current > FOREGROUND_GAP) sync("foreground");
      // Back from Google Calendar etc.: re-read phone calendars right away.
      else if (Date.now() - lastLocal.current > LOCAL_GAP) sync("resume", false, true);
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
      updateWidgetsSoon();
    });
    const unsubTheme = useThemeStore.subscribe((s, prev) => {
      if (s.mode !== prev.mode || s.accent !== prev.accent) updateWidgetsSoon(300);
    });

    return () => {
      sub.remove();
      unsubEvents();
      unsubTodos();
      unsubTheme();
      if (timer) clearTimeout(timer);
    };
  }, []);
}

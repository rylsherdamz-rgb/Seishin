import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";

const FOREGROUND_GAP = 10 * 60000;
const EDIT_DEBOUNCE = 8000;

/**
 * Keeps every connector in sync without the user thinking about it:
 * full sync on launch (and registers the ~30-min background task), again when
 * the app returns after 10+ minutes, and a light push shortly after edits —
 * so completing a task updates Google Calendar / Todoist / Notion quickly.
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

    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && Date.now() - last.current > FOREGROUND_GAP) sync("foreground");
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
      const a = own(s.events);
      const b = own(prev.events);
      if (a.length !== b.length || a.some((e, i) => e !== b[i])) pushSoon();
    });
    const unsubTodos = useTodoStore.subscribe((s, prev) => {
      if (s.todos !== prev.todos) pushSoon();
    });

    return () => {
      sub.remove();
      unsubEvents();
      unsubTodos();
      if (timer) clearTimeout(timer);
    };
  }, []);
}

import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";

const FOREGROUND_GAP = 10 * 60000;
const EDIT_DEBOUNCE = 8000;

/**
 * Keeps the phone-calendar connector in sync without the user thinking
 * about it: full sync on launch and when the app returns after 10+ minutes,
 * and an export-only push shortly after any event or task change.
 */
export function useCalendarAutoSync() {
  const last = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const full = async () => {
      const { readSyncState, syncCalendars } = await import("@/services/calendar-sync");
      if (cancelled || !readSyncState().enabled) return;
      last.current = Date.now();
      await syncCalendars();
    };
    full();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && Date.now() - last.current > FOREGROUND_GAP) full();
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const pushSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const { readSyncState, syncCalendars } = await import("@/services/calendar-sync");
        if (readSyncState().enabled) await syncCalendars({ exportOnly: true });
      }, EDIT_DEBOUNCE);
    };
    // Ignore changes made by the import itself (they only touch "calendar" events).
    const unsubEvents = useCalendarStore.subscribe((s, prev) => {
      if (s.events === prev.events) return;
      const own = (list: typeof s.events) => list.filter((e) => e.source !== "calendar");
      if (own(s.events).length !== own(prev.events).length || own(s.events).some((e, i) => e !== own(prev.events)[i])) pushSoon();
    });
    const unsubTodos = useTodoStore.subscribe((s, prev) => {
      if (s.todos !== prev.todos) pushSoon();
    });

    return () => {
      cancelled = true;
      sub.remove();
      unsubEvents();
      unsubTodos();
      if (timer) clearTimeout(timer);
    };
  }, []);
}

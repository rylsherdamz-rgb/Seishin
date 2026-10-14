/** Builds the light/dark tree for any Seishin widget from the current stores. */
import type { WidgetRepresentation } from "react-native-android-widget";
import { settingsStorage } from "@/stores/mmkv";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import type { Palette } from "@/theme/themes";
import { agendaFor, monthGrid, monthTitle, nextUp, tasksFor } from "./widget-data";
import { widgetPalettes } from "./theme";
import { AgendaWidget } from "./AgendaWidget";
import { TasksWidget } from "./TasksWidget";
import { MonthWidget } from "./MonthWidget";
import { NextUpWidget } from "./NextUpWidget";
import { QuickWidget } from "./QuickWidget";

export const WIDGET_NAMES = ["Agenda", "Tasks", "Month", "NextUp", "Quick"] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

/** Month widget paging, per placed widget. */
const monthKey = (widgetId: number) => `widgets:month:${widgetId}`;

export function monthOffset(widgetId: number): number {
  try {
    return settingsStorage.getNumber(monthKey(widgetId)) ?? 0;
  } catch {
    return 0;
  }
}

export function setMonthOffset(widgetId: number, offset: number | null) {
  try {
    if (offset === null || offset === 0) settingsStorage.remove(monthKey(widgetId));
    else settingsStorage.set(monthKey(widgetId), offset);
  } catch {
    // Paging just resets to this month.
  }
}

/** Stores may be cold (widget update with the app closed): read them from storage. */
function data() {
  const cal = useCalendarStore.getState();
  const todo = useTodoStore.getState();
  if (cal.events.length === 0) cal.loadEvents();
  if (todo.todos.length === 0) todo.loadTodos();
  return { events: useCalendarStore.getState().events, todos: useTodoStore.getState().todos };
}

function tree(name: string, P: Palette, widgetId: number, now: Date) {
  const { events, todos } = data();
  switch (name as WidgetName) {
    case "Agenda":
      return <AgendaWidget P={P} now={now} days={agendaFor(events, todos, now, 3)} />;
    case "Tasks":
      return <TasksWidget P={P} rows={tasksFor(todos, now)} />;
    case "Month": {
      const off = monthOffset(widgetId);
      const m = new Date(now.getFullYear(), now.getMonth() + off, 1);
      return <MonthWidget P={P} title={monthTitle(m.getFullYear(), m.getMonth())} isCurrent={off === 0} weeks={monthGrid(m.getFullYear(), m.getMonth(), events, todos, now)} />;
    }
    case "NextUp":
      return <NextUpWidget P={P} next={nextUp(events, todos, now)} />;
    default:
      return <QuickWidget P={P} />;
  }
}

export function renderSeishinWidget(name: string, widgetId: number, now = new Date()): WidgetRepresentation {
  const { light, dark } = widgetPalettes();
  return { light: tree(name, light, widgetId, now), dark: dark ? tree(name, dark, widgetId, now) : null };
}

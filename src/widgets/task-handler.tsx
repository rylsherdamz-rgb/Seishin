/**
 * Headless handler the launcher calls to draw widgets (added, resized,
 * periodic update) and for in-widget taps that don't open the app:
 * completing a task and paging the month.
 */
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { useTodoStore } from "@/stores/todo-store";
import { monthOffset, renderSeishinWidget, setMonthOffset } from "./render";
import { updateWidgets } from "./update";

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  const { widgetName, widgetId } = widgetInfo;
  switch (widgetAction) {
    case "WIDGET_DELETED":
      setMonthOffset(widgetId, null);
      return;
    case "WIDGET_CLICK": {
      if (clickAction === "TOGGLE_TASK" && typeof clickActionData?.id === "string") {
        const store = useTodoStore.getState();
        if (store.todos.length === 0) store.loadTodos();
        const t = useTodoStore.getState().todos.find((x) => x.id === clickActionData.id);
        // toggleTodo also stops the task's reminders.
        if (t && !t.completed) useTodoStore.getState().toggleTodo(t.id);
        renderWidget(renderSeishinWidget(widgetName, widgetId));
        await updateWidgets(); // the other widgets show the same task
        return;
      }
      if (clickAction === "MONTH_PREV" || clickAction === "MONTH_NEXT" || clickAction === "MONTH_TODAY") {
        const off = clickAction === "MONTH_TODAY" ? 0 : monthOffset(widgetId) + (clickAction === "MONTH_NEXT" ? 1 : -1);
        setMonthOffset(widgetId, off);
      }
      renderWidget(renderSeishinWidget(widgetName, widgetId));
      return;
    }
    default:
      renderWidget(renderSeishinWidget(widgetName, widgetId));
  }
}

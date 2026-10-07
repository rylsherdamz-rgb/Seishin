import { Alert } from "react-native";
import { ItemSheet } from "@/components/ItemSheet";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { COPY } from "@/constants/copy";
import type { CalendarItem } from "./calendar-utils";

interface Props {
  item: CalendarItem;
  onClose: () => void;
  onEdit: (eventId: string) => void;
}

/** Adapts a calendar row (event occurrence or task) to the shared detail sheet. */
export function CalendarItemSheet({ item, onClose, onEdit }: Props) {
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);

  const remove = (ok: boolean) => {
    if (!ok) Alert.alert(COPY.errors.saveFailedTitle, COPY.errors.deleteFailed);
    else onClose();
  };

  if (item.type === "event") {
    const id = item.eventId || item.id;
    return (
      <ItemSheet
        event={{ ...item, id, eventId: id }}
        onEventDelete={(eid) => remove(deleteEvent(eid))}
        onEventEdit={(ev) => { onClose(); onEdit(ev.id); }}
        onClose={onClose}
      />
    );
  }
  const id = item.todoId || item.id;
  return (
    <ItemSheet
      todo={{ ...item, id, todoId: id }}
      onTodoToggle={(tid) => toggleTodo(tid)}
      onTodoDelete={(tid) => remove(deleteTodo(tid))}
      onClose={onClose}
    />
  );
}

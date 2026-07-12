import { useCallback, useRef, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { useNotesStore } from "@/stores/notes-store";
import { useTodoStore } from "@/stores/todo-store";
import { SheetModal } from "@/components/ui/SheetModal";
import Feather from "@expo/vector-icons/Feather";

interface EventData {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  source?: string;
  notes?: string;
  eventId?: string;
}

interface TodoData {
  id: string;
  title: string;
  date?: string;
  priority?: string;
  completed?: boolean;
  todoId?: string;
}

interface ItemSheetProps {
  event?: EventData | null;
  todo?: TodoData | null;
  onEventDelete?: (id: string) => void;
  onTodoToggle?: (id: string) => void;
  onTodoDelete?: (id: string) => void;
  onClose?: () => void;
}

export function ItemSheet({ event, todo, onEventDelete, onTodoToggle, onTodoDelete, onClose }: ItemSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["50%", "80%"], []);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const eventNotes = useNotesStore((s) => event ? s.getNotesForEvent(event.id) : []);
  const eventTodos = useTodoStore((s) => event ? s.getTodosForEvent(event.id) : []);

  const handleClose = useCallback(() => {
    sheetRef.current?.close();
    onClose?.();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      index={0}
      handleIndicatorStyle={{ backgroundColor: "#cccccc", width: 40 }}
      backgroundStyle={{ backgroundColor: "#ffffff" }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      )}
      onClose={onClose}
    >
      <BottomSheetView className="flex-1 px-5 pb-6">
        {event ? (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center gap-3 mb-5">
              <View className="w-10 h-10 bg-black rounded-full items-center justify-center">
                <Feather name="calendar" size={16} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold tracking-tightest text-black">{event.title}</Text>
                {event.source && (
                  <Text className="text-xs text-ink-400 capitalize">Source: {event.source}</Text>
                )}
              </View>
            </View>

            <View className="bg-ink-50 border border-ink-100 rounded-card p-4 mb-4">
              <View className="flex-row items-center gap-3 mb-2">
                <Feather name="calendar" size={14} color="#666666" />
                <Text className="text-sm text-black">
                  {new Date(event.date + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                </Text>
              </View>
              {event.time && (
                <View className="flex-row items-center gap-3">
                  <Feather name="clock" size={14} color="#666666" />
                  <Text className="text-sm text-black">{event.time}</Text>
                </View>
              )}
            </View>

            {event.description && (
              <View className="mb-4">
                <Text className="text-xs font-medium text-ink-400 mb-1">Description</Text>
                <Text className="text-sm text-black leading-5">{event.description}</Text>
              </View>
            )}

            {eventNotes.length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-medium text-ink-400 mb-2">Notes</Text>
                {eventNotes.map((n) => (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => router.push(`/note?id=${n.id}`)}
                    className="flex-row items-center gap-3 bg-ink-50 rounded-xl px-4 py-3 mb-1.5"
                    activeOpacity={0.7}
                  >
                    <View className="w-8 h-8 bg-ink-100 rounded-full items-center justify-center">
                      <Feather name="file-text" size={14} color="#666" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-black">{n.title || "Untitled"}</Text>
                      {n.body && <Text className="text-xs text-ink-400 mt-0.5" numberOfLines={1}>{n.body}</Text>}
                    </View>
                    <Feather name="chevron-right" size={14} color="#ccc" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {eventTodos.length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-medium text-ink-400 mb-2">Todos</Text>
                {eventTodos.map((t) => (
                  <View key={t.id} className="flex-row items-center gap-3 bg-ink-50 rounded-xl px-4 py-3 mb-1.5">
                    <TouchableOpacity
                      onPress={() => { useTodoStore.getState().toggleTodo(t.id); }}
                      className={`w-6 h-6 rounded-md border-2 items-center justify-center ${
                        t.completed ? "bg-black border-black" : "border-ink-300"
                      }`}
                    >
                      {t.completed && <Feather name="check" size={12} color="#ffffff" />}
                    </TouchableOpacity>
                    <View className="flex-1">
                      <Text className={`text-sm ${t.completed ? "line-through text-ink-300" : "text-black"}`}>
                        {t.title}
                      </Text>
                      {t.dueDate && (
                        <Text className="text-xs text-ink-400 mt-0.5">
                          Due {new Date(t.dueDate).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                    <View className={`px-2 py-0.5 rounded-full ${
                      t.priority === "high" ? "bg-danger-soft" :
                      t.priority === "low" ? "bg-ink-100" : "bg-ink-75"
                    }`}>
                      <Text className={`text-[10px] font-medium ${
                        t.priority === "high" ? "text-danger" : "text-ink-400"
                      }`}>{t.priority}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View className="flex-row flex-wrap gap-2 mb-4">
              <TouchableOpacity
                onPress={() => router.push(`/note?eventId=${event.id}`)}
                className="flex-1 h-11 bg-ink-100 rounded-xl items-center justify-center flex-row gap-2"
                activeOpacity={0.7}
              >
                <Feather name="file-text" size={14} color="#000" />
                <Text className="text-sm font-medium text-black">Add Note</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/todo?eventId=${event.id}`)}
                className="flex-1 h-11 bg-ink-100 rounded-xl items-center justify-center flex-row gap-2"
                activeOpacity={0.7}
              >
                <Feather name="check-square" size={14} color="#000" />
                <Text className="text-sm font-medium text-black">Add Todo</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleDelete} className="h-12 border border-danger rounded-xl items-center justify-center flex-row gap-2">
              <Feather name="trash-2" size={14} color="#ff3b30" />
              <Text className="text-sm font-medium text-danger">Delete Event</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : todo ? (
          <>
            <View className="flex-row items-center gap-3 mb-5">
              <TouchableOpacity
                onPress={() => { onTodoToggle?.(todo.todoId || todo.id); handleClose(); }}
                className={`w-10 h-10 rounded-full items-center justify-center ${todo.completed ? "bg-black" : "bg-ink-100"}`}
              >
                <Feather name="check" size={16} color={todo.completed ? "#ffffff" : "#666666"} />
              </TouchableOpacity>
              <View className="flex-1">
                <Text className={`text-lg font-semibold tracking-tightest ${todo.completed ? "line-through text-ink-300" : "text-black"}`}>
                  {todo.title}
                </Text>
                <Text className="text-xs text-ink-400">Todo</Text>
              </View>
            </View>

            <View className="bg-ink-50 border border-ink-100 rounded-card p-4 mb-4">
              {todo.date && (
                <View className="flex-row items-center gap-3 mb-2">
                  <Feather name="calendar" size={14} color="#666666" />
                  <Text className="text-sm text-black">
                    Due {new Date(todo.date + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "short", month: "short", day: "numeric",
                    })}
                  </Text>
                </View>
              )}
              <View className="flex-row items-center gap-3">
                <Feather name="flag" size={14} color="#666666" />
                <Text className="text-sm text-black capitalize">Priority: {todo.priority || "medium"}</Text>
              </View>
              <View className="flex-row items-center gap-3 mt-2">
                <Feather name="check-circle" size={14} color="#666666" />
                <Text className="text-sm text-black">{todo.completed ? "Completed" : "Active"}</Text>
              </View>
            </View>

            <View className="flex-row gap-3 mt-auto">
              <TouchableOpacity
                onPress={() => { onTodoToggle?.(todo.todoId || todo.id); handleClose(); }}
                className={`flex-1 h-12 rounded-xl items-center justify-center flex-row gap-2 ${
                  todo.completed ? "border border-ink-200" : "bg-black"
                }`}
              >
                <Feather name={todo.completed ? "rotate-ccw" : "check"} size={14} color={todo.completed ? "#000000" : "#ffffff"} />
                <Text className={`text-sm font-medium ${todo.completed ? "text-black" : "text-white"}`}>
                  {todo.completed ? "Reopen" : "Complete"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} className="flex-1 h-12 border border-danger rounded-xl items-center justify-center flex-row gap-2">
                <Feather name="trash-2" size={14} color="#ff3b30" />
                <Text className="text-sm font-medium text-danger">Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </BottomSheetView>
      <SheetModal
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete"
        message={`Delete "${event?.title || todo?.title || ""}"?`}
        confirmLabel="Delete"
        confirmDestructive
        onConfirm={() => {
          if (event && onEventDelete) onEventDelete(event.id);
          if (todo && onTodoDelete) onTodoDelete(todo.id);
          handleClose();
        }}
      />
    </BottomSheet>
  );
}

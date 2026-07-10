import { useCallback, useRef, useMemo } from "react";
import { View, Text, TouchableOpacity, Alert, Platform } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";

interface EventData {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  source?: string;
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
  const snapPoints = useMemo(() => ["40%", "60%"], []);

  const handleClose = useCallback(() => {
    sheetRef.current?.close();
    onClose?.();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    const title = event?.title || todo?.title || "";
    Alert.alert("Delete", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          if (event && onEventDelete) onEventDelete(event.id);
          if (todo && onTodoDelete) onTodoDelete(todo.id);
          handleClose();
        },
      },
    ]);
  }, [event, todo, onEventDelete, onTodoDelete, handleClose]);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      index={0}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      )}
      onClose={onClose}
    >
      <BottomSheetView className="flex-1 px-5 pb-6">
        {event ? (
          <>
            <View className="flex-row items-center gap-3 mb-5">
              <View className="w-10 h-10 bg-black rounded-full items-center justify-center">
                <Feather name="calendar" size={16} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-black">{event.title}</Text>
                {event.source && (
                  <Text className="text-xs text-ink-400 capitalize">Source: {event.source}</Text>
                )}
              </View>
            </View>

            <View className="bg-ink-100 rounded-xl p-4 mb-4">
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

            <View className="flex-row gap-3 mt-auto">
              <TouchableOpacity onPress={handleDelete} className="flex-1 h-12 border border-danger rounded-xl items-center justify-center flex-row gap-2">
                <Feather name="trash-2" size={14} color="#ff3b30" />
                <Text className="text-sm font-medium text-danger">Delete</Text>
              </TouchableOpacity>
            </View>
          </>
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
                <Text className={`text-lg font-semibold ${todo.completed ? "line-through text-ink-300" : "text-black"}`}>
                  {todo.title}
                </Text>
                <Text className="text-xs text-ink-400">Todo</Text>
              </View>
            </View>

            <View className="bg-ink-100 rounded-xl p-4 mb-4">
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
    </BottomSheet>
  );
}

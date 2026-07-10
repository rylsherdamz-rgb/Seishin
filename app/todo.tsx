import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useTodoStore, Todo } from "@/stores/todo-store";
import { Card } from "@/components/ui/Card";
import { ItemSheet } from "@/components/ItemSheet";
import { Logo } from "@/components/Logo";
import Feather from "@expo/vector-icons/Feather";

type TodoFilter = "all" | "active" | "completed";

export default function TodoScreen() {
  const {
    todos, loadTodos, addTodo, toggleTodo, deleteTodo, clearCompleted, setFilter, getFilteredTodos, getStats,
  } = useTodoStore();
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filter, localFilter] = useState<TodoFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [sheetItem, setSheetItem] = useState<Todo | null>(null);

  useEffect(() => { loadTodos(); }, []);

  const filtered = getFilteredTodos();
  const stats = getStats();

  function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    addTodo({
      id: `todo-${Date.now()}`,
      title,
      completed: false,
      priority: "medium",
      category: "general",
      tags: [],
      createdAt: new Date().toISOString(),
      dueDate: newDueDate ? newDueDate.toISOString() : undefined,
    });
    setNewTitle("");
    setNewDueDate(null);
    setShowAdd(false);
  }

  const priorityColors: Record<string, string> = {
    low: "text-ink-300",
    medium: "text-black",
    high: "text-danger",
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="arrow-left" size={16} color="#000000" />
          </TouchableOpacity>
          <Logo size={32} />
          <View>
            <Text className="text-2xl font-semibold tracking-tight text-black">Todo List</Text>
            <Text className="text-sm text-ink-500 mt-0.5">
              {stats.active} pending · {stats.completed} done
            </Text>
          </View>
        </View>
        {stats.completed > 0 && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Clear Completed", "Delete all completed todos?", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: clearCompleted },
              ]);
            }}
            className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center"
          >
            <Feather name="check-circle" size={14} color="#666666" />
          </TouchableOpacity>
        )}
      </View>

      <View className="flex-row px-4 gap-2 mb-4">
        {(["all", "active", "completed"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => { localFilter(f); setFilter(f); }}
            className={`px-3 py-1.5 rounded-full border ${
              filter === f ? "bg-black border-black" : "border-ink-200"
            }`}
          >
            <Text className={`text-xs font-medium ${filter === f ? "text-white" : "text-ink-500"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={() => setShowAdd(!showAdd)}
        className="mx-4 mb-3 h-11 border-2 border-dashed border-ink-200 rounded-xl items-center justify-center flex-row gap-2"
      >
        <Feather name="plus" size={16} color="#999999" />
        <Text className="text-sm text-ink-300 font-medium">Add Todo</Text>
      </TouchableOpacity>

      {showAdd && (
        <Card className="mx-4 mb-4">
          <TextInput
            className="h-11 border border-ink-200 rounded-lg px-3 text-sm text-black mb-2"
            placeholder="What needs to be done?"
            placeholderTextColor="#999999"
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={handleAdd}
            autoFocus
          />
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="flex-row items-center gap-2 mb-3 h-9 border border-ink-200 rounded-lg px-3"
          >
            <Feather name="calendar" size={14} color="#999999" />
            <Text className={`text-sm flex-1 ${newDueDate ? "text-black" : "text-ink-300"}`}>
              {newDueDate
                ? newDueDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                : "Set due date"}
            </Text>
            {newDueDate && (
              <TouchableOpacity onPress={() => setNewDueDate(null)}>
                <Feather name="x-circle" size={14} color="#cccccc" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {showDatePicker && (
            <View className="mb-3">
              <DateTimePicker
                value={newDueDate || new Date()}
                mode="date"
                onChange={(_, d) => { setShowDatePicker(false); if (d) setNewDueDate(d); }}
              />
            </View>
          )}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setShowAdd(false)}
              className="flex-1 h-12 border border-ink-200 rounded-lg items-center justify-center"
            >
              <Text className="text-base text-ink-500 font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAdd}
              className="flex-1 h-12 bg-black rounded-lg items-center justify-center"
            >
              <Text className="text-base text-white font-medium">Add</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSheetItem(item)}>
            <Card className="flex-row items-center gap-3 mb-2">
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); toggleTodo(item.id); }}
                className={`w-5 h-5 rounded-sm border-2 items-center justify-center ${
                  item.completed ? "bg-black border-black" : "border-ink-300"
                }`}
              >
                {item.completed && <Feather name="check" size={10} color="#ffffff" />}
              </TouchableOpacity>
              <View className="flex-1">
                <Text className={`text-sm ${item.completed ? "line-through text-ink-300" : "text-black"}`}>
                  {item.title}
                </Text>
                {item.dueDate && (
                  <View className="flex-row items-center gap-1 mt-0.5">
                    <Feather name="clock" size={10} color="#999999" />
                    <Text className="text-xs text-ink-300">
                      {new Date(item.dueDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    </Text>
                  </View>
                )}
              </View>
              <Text className={`text-xs font-medium ${priorityColors[item.priority]}`}>
                {item.priority}
              </Text>
              <Feather name="chevron-up" size={14} color="#d0d0d0" />
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <View className="w-14 h-14 bg-ink-100 rounded-full items-center justify-center mb-4">
              <Feather name="check-square" size={20} color="#cccccc" />
            </View>
            <Text className="text-base text-ink-300">No todos yet</Text>
            <Text className="text-xs text-ink-200 mt-1">Tap + to add one</Text>
          </View>
        }
      />

      {sheetItem && (
        <ItemSheet
          todo={{
            id: sheetItem.id,
            title: sheetItem.title,
            date: sheetItem.dueDate?.split("T")[0],
            priority: sheetItem.priority,
            completed: sheetItem.completed,
            todoId: sheetItem.id,
          }}
          onTodoToggle={(id) => { toggleTodo(id); setSheetItem(null); }}
          onTodoDelete={(id) => { deleteTodo(id); setSheetItem(null); }}
          onClose={() => setSheetItem(null)}
        />
      )}
    </SafeAreaView>
  );
}

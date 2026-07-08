import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useTodoStore, Todo } from "@/stores/todo-store";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/Logo";
import Feather from "@expo/vector-icons/Feather";

type TodoFilter = "all" | "active" | "completed";

export default function TodoScreen() {
  const {
    todos, loadTodos, addTodo, toggleTodo, deleteTodo, clearCompleted, setFilter, getFilteredTodos, getStats,
  } = useTodoStore();
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [filter, localFilter] = useState<TodoFilter>("all");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { loadTodos(); }, []);

  const filtered = getFilteredTodos();
  const stats = getStats();

  function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    const dueDateStr = newDueDate.trim();
    let dueDate: string | undefined;
    if (dueDateStr) {
      const parsed = new Date(dueDateStr);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed.toISOString();
      }
    }
    addTodo({
      id: `todo-${Date.now()}`,
      title,
      completed: false,
      priority: "medium",
      category: "general",
      tags: [],
      createdAt: new Date().toISOString(),
      dueDate,
    });
    setNewTitle("");
    setNewDueDate("");
    setShowAdd(false);
  }

  const priorityColors: Record<string, string> = {
    low: "text-ink-300",
    medium: "text-black",
    high: "text-red-500",
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-4 pb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="arrow-left" size={16} color="#000000" />
          </TouchableOpacity>
          <Logo size={32} />
          <View>
            <Text className="text-xl font-semibold tracking-tight text-black">Todo List</Text>
            <Text className="text-xs text-ink-500 mt-0.5">
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
          <View className="flex-row items-center gap-2 mb-3">
            <Feather name="calendar" size={14} color="#999999" />
            <TextInput
              className="flex-1 h-9 border border-ink-200 rounded-lg px-3 text-sm text-black"
              placeholder="Due date (YYYY-MM-DD)"
              placeholderTextColor="#999999"
              value={newDueDate}
              onChangeText={setNewDueDate}
            />
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setShowAdd(false)}
              className="flex-1 h-9 border border-ink-200 rounded-lg items-center justify-center"
            >
              <Text className="text-xs text-ink-500">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAdd}
              className="flex-1 h-9 bg-black rounded-lg items-center justify-center"
            >
              <Text className="text-xs text-white font-medium">Add</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => toggleTodo(item.id)}>
            <Card className="flex-row items-center gap-3 mb-2">
              <View className={`w-5 h-5 rounded-sm border-2 items-center justify-center ${
                item.completed ? "bg-black border-black" : "border-ink-300"
              }`}>
                {item.completed && <Feather name="check" size={10} color="#ffffff" />}
              </View>
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
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); deleteTodo(item.id); }}
                className="w-8 h-8 items-center justify-center"
              >
                <Feather name="x" size={14} color="#cccccc" />
              </TouchableOpacity>
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
    </SafeAreaView>
  );
}

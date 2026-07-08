import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTodoStore, Todo } from "@/stores/todo-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function TodoScreen() {
  const insets = useSafeAreaInsets();
  const { todos, loadTodos, addTodo, toggleTodo, deleteTodo, clearCompleted, setFilter, getFilteredTodos, getStats } = useTodoStore();
  const [newTitle, setNewTitle] = useState("");
  const [filter, localFilter] = useState<"all" | "active" | "completed">("all");
  const filtered = getFilteredTodos();
  const stats = getStats();

  useEffect(() => { loadTodos(); }, []);

  function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    const todo: Todo = {
      id: `todo-${Date.now()}`,
      title,
      completed: false,
      priority: "medium",
      category: "general",
      tags: [],
      createdAt: new Date().toISOString(),
    };
    addTodo(todo);
    setNewTitle("");
  }

  const priorityColors: Record<string, string> = {
    low: "text-gray-400",
    medium: "text-black",
    high: "text-red-500",
  };

  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-4">
        <Text className="text-2xl font-semibold text-black">Todo List</Text>
        <Text className="text-sm text-gray-500 mt-1">
          {stats.active} active · {stats.completed} completed
        </Text>
      </View>

      <View className="px-4 mb-4">
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 h-12 border border-black rounded-lg px-4 text-base text-black"
            placeholder="Add a todo..."
            placeholderTextColor="#999"
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity
            onPress={handleAdd}
            className="bg-black h-12 w-12 items-center justify-center rounded-lg"
          >
            <Text className="text-white text-xl">+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-row px-4 gap-2 mb-4">
        {(["all", "active", "completed"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => { localFilter(f); setFilter(f); }}
            className={`px-4 py-2 rounded-full border ${
              filter === f ? "bg-black border-black" : "border-gray-300"
            }`}
          >
            <Text className={`text-sm ${filter === f ? "text-white" : "text-gray-600"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        {stats.completed > 0 && (
          <TouchableOpacity onPress={() => {
            Alert.alert("Clear Completed", "Delete all completed todos?", [
              { text: "Cancel", style: "cancel" },
              { text: "Clear", style: "destructive", onPress: clearCompleted },
            ]);
          }}>
            <Text className="text-sm text-red-500 px-2 py-2">Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <Card className="flex-row items-center gap-3 mb-2">
            <TouchableOpacity onPress={() => toggleTodo(item.id)}>
              <View className={`w-5 h-5 border-2 rounded-sm items-center justify-center ${
                item.completed ? "bg-black border-black" : "border-gray-400"
              }`}>
                {item.completed && <Text className="text-white text-xs">✓</Text>}
              </View>
            </TouchableOpacity>
            <View className="flex-1">
              <Text className={`text-sm ${item.completed ? "line-through text-gray-400" : "text-black"}`}>
                {item.title}
              </Text>
              {item.dueDate && (
                <Text className="text-xs text-gray-400 mt-0.5">
                  Due: {new Date(item.dueDate).toLocaleDateString()}
                </Text>
              )}
            </View>
            <Text className={`text-xs ${priorityColors[item.priority]}`}>
              {item.priority}
            </Text>
            <TouchableOpacity onPress={() => deleteTodo(item.id)}>
              <Text className="text-gray-400 text-lg">✕</Text>
            </TouchableOpacity>
          </Card>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <Text className="text-gray-400 text-base">No todos yet</Text>
          </View>
        }
      />
    </View>
  );
}

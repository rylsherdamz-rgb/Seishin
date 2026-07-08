import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert } from "react-native";
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
  const [filter, localFilter] = useState<TodoFilter>("all");

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
    });
    setNewTitle("");
  }

  const priorityColors: Record<string, string> = {
    low: "text-ink-300",
    medium: "text-black",
    high: "text-red-500",
  };

  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Logo size={36} />
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

      <View className="px-4 mb-4">
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 h-12 border border-ink-200 rounded-xl px-4 text-base text-black"
            placeholder="Add a todo..."
            placeholderTextColor="#999999"
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={handleAdd}
          />
          <TouchableOpacity
            onPress={handleAdd}
            className="bg-black h-12 w-12 items-center justify-center rounded-xl"
          >
            <Feather name="plus" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

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
                    <Feather name="clock" size={10} color="#cccccc" />
                    <Text className="text-xs text-ink-300">
                      {new Date(item.dueDate).toLocaleDateString()}
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
            <Text className="text-xs text-ink-200 mt-1">Add one above</Text>
          </View>
        }
      />
    </View>
  );
}

import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Calendar, LocaleConfig } from "react-native-calendars";

LocaleConfig.locales["en"] = {
  monthNames: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  today: "Today",
};
LocaleConfig.defaultLocale = "en";
import { useCalendarStore, CalendarEvent } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { Card } from "@/components/ui/Card";
import Feather from "@expo/vector-icons/Feather";

interface CalendarItem {
  id: string;
  type: "event" | "todo";
  title: string;
  description?: string;
  date: string;
  time?: string;
  source?: string;
  priority?: string;
  completed?: boolean;
  todoId?: string;
}

export default function CalendarScreen() {
  const { events, selectedDate, loadEvents, deleteEvent, setSelectedDate, getEventsForDate } =
    useCalendarStore();
  const { todos, loadTodos, toggleTodo } = useTodoStore();

  useEffect(() => {
    loadEvents();
    loadTodos();
  }, []);

  const allItems: CalendarItem[] = [
    ...events.map((e) => ({
      id: e.id,
      type: "event" as const,
      title: e.title,
      description: e.description,
      date: e.startDate.split("T")[0],
      time: new Date(e.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      source: e.source,
    })),
    ...todos
      .filter((t) => t.dueDate)
      .map((t) => ({
        id: `todo-${t.id}`,
        type: "todo" as const,
        title: t.title,
        date: t.dueDate!.split("T")[0],
        priority: t.priority,
        completed: t.completed,
        todoId: t.id,
      })),
  ];

  const markedDates: Record<string, any> = {};
  allItems.forEach((item) => {
    if (!markedDates[item.date]) {
      markedDates[item.date] = { marked: true, dots: [] };
    }
    if (!markedDates[item.date].dots) {
      markedDates[item.date].dots = [];
    }
    markedDates[item.date].dots.push({
      color: item.type === "event" ? "#000000" : "#999999",
    });
  });

  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] || { dots: [], marked: true }),
      selected: true,
      selectedColor: "#000000",
    };
  }

  const dayItems = allItems
    .filter((item) => item.date === selectedDate)
    .sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });

  const sourceIcons: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
    manual: "edit-2", ocr: "camera", email: "mail",
    notification: "bell", chat: "message-circle", ai: "cpu",
  };

  const handleDeleteEvent = useCallback((id: string, title: string) => {
    Alert.alert("Delete Event", `Delete "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteEvent(id) },
    ]);
  }, [deleteEvent]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-semibold tracking-tight text-black">Calendar</Text>
          <Text className="text-sm text-ink-500 mt-1">
            {events.length} events · {todos.filter((t) => t.dueDate).length} todo dates
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/todo")}
          className="w-10 h-10 bg-black rounded-full items-center justify-center"
        >
          <Feather name="plus" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <Calendar
        current={selectedDate}
        onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
        markedDates={markedDates}
        markingType="multi-dot"
        theme={{
          todayTextColor: "#000000",
          selectedDayBackgroundColor: "#000000",
          selectedDayTextColor: "#ffffff",
          arrowColor: "#000000",
          monthTextColor: "#000000",
          textMonthFontWeight: "600",
          textMonthFontSize: 15,
          textDayFontSize: 14,
          textDayHeaderFontSize: 12,
        }}
        style={{ borderBottomWidth: 1, borderBottomColor: "#e5e5e5", paddingBottom: 8 }}
      />

      <View className="pt-4 px-4 flex-row items-center justify-between">
        <Text className="text-sm font-medium text-ink-700">
          {selectedDate
            ? new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long", month: "long", day: "numeric",
              })
            : "Select a date"}
        </Text>
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <View className="w-2 h-2 rounded-full bg-black" />
            <Text className="text-xs text-ink-300">Events</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <View className="w-2 h-2 rounded-full bg-ink-300" />
            <Text className="text-xs text-ink-300">Todos</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={dayItems}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) =>
          item.type === "event" ? (
            <Card className="flex-row items-center gap-4 mb-2">
              <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                <Feather
                  name={sourceIcons[item.source || ""] || "calendar"}
                  size={16} color="#000000"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-black">{item.title}</Text>
                {item.description && (
                  <Text className="text-xs text-ink-500 mt-0.5" numberOfLines={1}>{item.description}</Text>
                )}
                <View className="flex-row items-center gap-2 mt-1">
                  <Feather name="clock" size={10} color="#999999" />
                  <Text className="text-xs text-ink-300">{item.time}</Text>
                  <Text className="text-xs text-ink-200">·</Text>
                  <Text className="text-xs text-ink-300 capitalize">{item.source}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteEvent(item.id, item.title)}
                className="w-8 h-8 items-center justify-center"
              >
                <Feather name="trash-2" size={14} color="#999999" />
              </TouchableOpacity>
            </Card>
          ) : (
            <TouchableOpacity
              onPress={() => item.todoId && toggleTodo(item.todoId)}
              onLongPress={() => router.push("/todo")}
            >
              <Card className="flex-row items-center gap-4 mb-2 opacity-90">
                <View className={`w-10 h-10 rounded-full items-center justify-center ${
                  item.completed ? "bg-black" : "bg-ink-100"
                }`}>
                  <Feather name="check-square" size={16} color={item.completed ? "#ffffff" : "#666666"} />
                </View>
                <View className="flex-1">
                  <Text className={`text-sm ${item.completed ? "line-through text-ink-300" : "text-black"}`}>
                    {item.title}
                  </Text>
                  <Text className="text-xs text-ink-300 mt-0.5">
                    Todo{item.priority ? ` · ${item.priority}` : ""}
                  </Text>
                </View>
                <View className={`px-2 py-0.5 rounded ${
                  item.priority === "high" ? "bg-red-50" : "bg-ink-100"
                }`}>
                  <Text className={`text-xs ${
                    item.priority === "high" ? "text-red-500" : "text-ink-300"
                  }`}>
                    {item.priority || "todo"}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          )
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Feather name="calendar" size={32} color="#cccccc" />
            <Text className="text-base text-ink-300 mt-4">Nothing this day</Text>
            <Text className="text-xs text-ink-200 mt-1">Tap + to add a todo</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

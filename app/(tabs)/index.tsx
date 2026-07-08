import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert } from "react-native";
import { Calendar } from "react-native-calendars";
import { useCalendarStore, CalendarEvent } from "@/stores/calendar-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Feather from "@expo/vector-icons/Feather";

export default function CalendarScreen() {
  const { events, selectedDate, loadEvents, deleteEvent, setSelectedDate, getEventsForDate } =
    useCalendarStore();

  useEffect(() => {
    loadEvents();
  }, []);

  const markedDates = events.reduce(
    (acc, event) => {
      const date = event.startDate.split("T")[0];
      if (!acc[date]) acc[date] = { dots: [], marked: true };
      const existing = acc[date];
      if (!existing.dots) existing.dots = [];
      existing.dots.push({ color: "#000000" });
      return acc;
    },
    {} as Record<string, any>
  );

  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] || { dots: [], marked: true }),
      selected: true,
      selectedColor: "#000000",
    };
  }

  const dayEvents = getEventsForDate(selectedDate);

  const sourceIcons: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
    manual: "edit-2",
    ocr: "camera",
    email: "mail",
    notification: "bell",
    chat: "message-circle",
    ai: "cpu",
  };

  const handleDeleteEvent = useCallback(
    (id: string, title: string) => {
      Alert.alert("Delete Event", `Delete "${title}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteEvent(id) },
      ]);
    },
    [deleteEvent]
  );

  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-4">
        <Text className="text-2xl font-semibold tracking-tight text-black">
          Calendar
        </Text>
        <Text className="text-sm text-ink-500 mt-1">
          {events.length} event{events.length !== 1 ? "s" : ""}
        </Text>
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
        style={{
          borderBottomWidth: 1,
          borderBottomColor: "#e5e5e5",
          paddingBottom: 8,
        }}
      />

      <View className="pt-4 px-4">
        <Text className="text-sm font-medium text-ink-700 mb-3">
          {selectedDate
            ? new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : "Select a date"}
        </Text>
      </View>

      <FlatList
        data={dayEvents}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <Card className="flex-row items-center gap-4 mb-2">
            <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
              <Feather
                name={sourceIcons[item.source] || "calendar"}
                size={16}
                color="#000000"
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-black">{item.title}</Text>
              {item.description && (
                <Text className="text-xs text-ink-500 mt-0.5" numberOfLines={1}>
                  {item.description}
                </Text>
              )}
              <View className="flex-row items-center gap-2 mt-1">
                <Feather name="clock" size={10} color="#999999" />
                <Text className="text-xs text-ink-300">
                  {new Date(item.startDate).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
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
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Feather name="calendar" size={32} color="#cccccc" />
            <Text className="text-base text-ink-300 mt-4">No events this day</Text>
          </View>
        }
      />
    </View>
  );
}

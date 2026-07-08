import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { Calendar, DateData } from "react-native-calendars";
import { useCalendarStore, CalendarEvent } from "@/stores/calendar-store";

export default function CalendarScreen() {
  const { events, selectedDate, loadEvents, setSelectedDate, getEventsForDate } =
    useCalendarStore();
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    const marks: Record<string, any> = {};
    events.forEach((e) => {
      const date = e.startDate.split("T")[0];
      marks[date] = { marked: true, dotColor: "#000000" };
    });
    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: "#000000",
    };
    setMarkedDates(marks);
  }, [events, selectedDate]);

  const dayEvents = getEventsForDate(selectedDate);

  const sourceLabel = (s: string) => {
    const labels: Record<string, string> = {
      manual: "Manual",
      ocr: "OCR",
      email: "Email",
      notification: "Notif",
      chat: "Chat",
      ai: "AI",
    };
    return labels[s] || s;
  };

  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-2">
        <Text className="text-2xl font-semibold text-black">Calendar</Text>
      </View>

      <Calendar
        current={selectedDate}
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        markedDates={markedDates}
        theme={{
          todayTextColor: "#000000",
          selectedDayBackgroundColor: "#000000",
          selectedDayTextColor: "#ffffff",
          arrowColor: "#000000",
          monthTextColor: "#000000",
          textMonthFontWeight: "600",
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
        }}
      />

      <View className="flex-1 px-4 pt-4">
        <Text className="text-sm text-gray-500 mb-3">
          {dayEvents.length === 0
            ? "No events for this day"
            : `${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}`}
        </Text>

        <FlatList
          data={dayEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: CalendarEvent }) => (
            <TouchableOpacity className="bg-ink-100 p-4 rounded-lg mb-2">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-black">
                    {item.title}
                  </Text>
                  {item.description && (
                    <Text className="text-sm text-gray-700 mt-1">
                      {item.description}
                    </Text>
                  )}
                  <Text className="text-xs text-gray-400 mt-2">
                    {formatTime(item.startDate)} – {formatTime(item.endDate)}
                  </Text>
                </View>
                <Text className="text-[10px] text-gray-400 uppercase">
                  {sourceLabel(item.source)}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-16">
              <Text className="text-base text-gray-500">No events yet</Text>
              <Text className="text-sm text-gray-400 mt-2 text-center">
                Events appear here from OCR scans,{"\n"}emails, notifications, and the AI agent
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

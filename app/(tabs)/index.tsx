import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, Modal, TextInput,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";

import { router } from "expo-router";
import { uid } from "@/utils/id";
import { SheetModal } from "@/components/ui/SheetModal";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { ItemSheet } from "@/components/ItemSheet";
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
  notes?: string;
  eventId?: string;
}

export default function CalendarScreen() {
  const { events, selectedDate, loadEvents, addEvent, deleteEvent, setSelectedDate } =
    useCalendarStore();
  const { todos, loadTodos, toggleTodo } = useTodoStore();
  const [showAll, setShowAll] = useState(false);

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
      notes: e.notes,
      eventId: e.id,
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

  function sortItems(items: CalendarItem[]): CalendarItem[] {
    return [...items].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
  }

  function buildSections(items: CalendarItem[]): ({ kind: "date-header"; date: string; label: string } | CalendarItem)[] {
    const sections: ({ kind: "date-header"; date: string; label: string } | CalendarItem)[] = [];
    let lastDate = "";
    for (const item of items) {
      if (item.date !== lastDate) {
        lastDate = item.date;
        const d = new Date(item.date + "T00:00:00");
        const label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
        sections.push({ kind: "date-header", date: item.date, label });
      }
      sections.push(item);
    }
    return sections;
  }

  const showAllItems = sortItems(allItems);
  const dayItems = sortItems(allItems.filter((item) => item.date === selectedDate));
  const displayItems = showAll || !selectedDate ? buildSections(showAllItems) : dayItems;

  // Distinguish current day vs. past vs. upcoming for clear temporal hierarchy.
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local)
  type WhenKind = "past" | "today" | "future";
  function whenOf(date: string): WhenKind {
    if (date < todayStr) return "past";
    if (date === todayStr) return "today";
    return "future";
  }

  const markedDates: Record<string, any> = {};
  allItems.forEach((item) => {
    if (!markedDates[item.date]) {
      markedDates[item.date] = { marked: true, _hasEvent: false, _hasTodo: false };
    }
    if (item.type === "event") markedDates[item.date]._hasEvent = true;
    else markedDates[item.date]._hasTodo = true;
  });
  // Collapse to at most two dots per day (events + todos) so a busy day
  // doesn't overflow the cell with a long row of dots.
  Object.keys(markedDates).forEach((d) => {
    const dots: { key: string; color: string }[] = [];
    if (markedDates[d]._hasEvent) dots.push({ key: "event", color: "#000000" });
    if (markedDates[d]._hasTodo) dots.push({ key: "todo", color: "#999999" });
    markedDates[d].dots = dots;
    delete markedDates[d]._hasEvent;
    delete markedDates[d]._hasTodo;
  });

  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] || { dots: [], marked: true }),
      selected: true,
      selectedColor: "#000000",
    };
  }

  const dayEvents = allItems
    .filter((item) => item.date === selectedDate && item.type === "event")
    .sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });
  const dayTodos = allItems
    .filter((item) => item.date === selectedDate && item.type === "todo")
    .sort((a, b) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (b.priority === "high" && a.priority !== "high") return 1;
      return a.title.localeCompare(b.title);
    });

  const sections: ({ kind: "header"; title: string; icon: React.ComponentProps<typeof Feather>["name"]; count: number } | CalendarItem)[] = [];
  if (dayEvents.length > 0) {
    sections.push({ kind: "header", title: "Events", icon: "calendar", count: dayEvents.length });
    sections.push(...dayEvents);
  }
  if (dayTodos.length > 0) {
    sections.push({ kind: "header", title: "Todos", icon: "check-square", count: dayTodos.length });
    sections.push(...dayTodos);
  }

  const sourceIcons: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
    manual: "edit-2", ocr: "camera", email: "mail",
    notification: "bell", chat: "message-circle", ai: "cpu",
  };

  const [sheetItem, setSheetItem] = useState<CalendarItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [eventTime, setEventTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showNoTextAlert, setShowNoTextAlert] = useState(false);
  const [showOcrError, setShowOcrError] = useState(false);
  const [showMissingTitle, setShowMissingTitle] = useState(false);
  function resetForm() {
    setEventTitle("");
    setEventNotes("");
    setEventDate(new Date());
    setEventTime(new Date());
  }

  function showAddOptions() {
    setShowAddSheet(true);
  }

  async function pickImageForOcr() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    try {
      const { recognizeText } = await import("@/services/ocr");
      const text = await recognizeText(uri);
      if (text.trim()) {
        setEventTitle(text.slice(0, 120));
        setShowModal(true);
      } else {
        setShowNoTextAlert(true);
      }
    } catch {
      setShowOcrError(true);
    }
  }

  function onDateChange(_: DateTimePickerEvent, d?: Date) {
    setShowDatePicker(false);
    if (d) setEventDate(d);
  }

  function onTimeChange(_: DateTimePickerEvent, d?: Date) {
    setShowTimePicker(false);
    if (d) setEventTime(d);
  }

  function saveEvent() {
    if (!eventTitle.trim()) {
      setShowMissingTitle(true);
      return;
    }
    const start = new Date(eventDate);
    start.setHours(eventTime.getHours(), eventTime.getMinutes(), 0, 0);
    const end = new Date(start.getTime() + 3600000);
    addEvent({
      id: uid("manual-evt"),
      title: eventTitle.trim(),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      source: "manual",
      notes: eventNotes.trim() || undefined,
    });
    setShowModal(false);
    resetForm();
  }

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-semibold tracking-tightest text-black">Calendar</Text>
          <Text className="text-sm text-ink-500 mt-1">
            {events.length} events · {todos.filter((t) => t.dueDate).length} todo dates
          </Text>
        </View>
        <TouchableOpacity
          onPress={showAddOptions}
          activeOpacity={0.85}
          className="w-11 h-11 bg-black rounded-full items-center justify-center shadow-raised"
        >
          <Feather name="plus" size={20} color="#ffffff" />
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
        <View className="flex-row items-center gap-2 flex-1">
          <Text className="text-sm font-medium text-ink-700">
            {showAll || !selectedDate
              ? "All items"
              : new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long", month: "long", day: "numeric",
                })
            }
          </Text>
          {!showAll && selectedDate === todayStr && (
            <View className="px-2 py-0.5 bg-black rounded-full">
              <Text className="text-[10px] font-bold text-white tracking-wide">TODAY</Text>
            </View>
          )}
          {!showAll && selectedDate && selectedDate < todayStr && (
            <View className="px-2 py-0.5 bg-ink-100 rounded-full">
              <Text className="text-[10px] font-semibold text-ink-400 tracking-wide">PAST</Text>
            </View>
          )}
        </View>
        <View className="flex-row items-center gap-3">
          {(selectedDate && !showAll) && (
            <TouchableOpacity onPress={() => setShowAll(true)}>
              <Text className="text-xs text-ink-400">Show all</Text>
            </TouchableOpacity>
          )}
          {showAll && (
            <TouchableOpacity onPress={() => setShowAll(false)}>
              <Text className="text-xs text-ink-400">Show day</Text>
            </TouchableOpacity>
          )}
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
        data={displayItems}
        className="flex-1"
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
        indicatorStyle="black"
        keyExtractor={(item) => ("kind" in item ? `header-${item.date}` : item.id)}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => {
          if ("kind" in item) {
            const when = whenOf(item.date);
            return (
              <View className="flex-row items-center gap-2 pt-4 pb-2">
                <View className={`w-1 h-4 rounded-full ${when === "past" ? "bg-ink-200" : "bg-black"}`} />
                <Text className={`text-sm font-semibold flex-1 ${when === "past" ? "text-ink-400" : "text-black"}`}>
                  {item.label}
                </Text>
                {when === "today" && (
                  <View className="px-2 py-0.5 bg-black rounded-full">
                    <Text className="text-[10px] font-bold text-white tracking-wide">TODAY</Text>
                  </View>
                )}
                {when === "past" && (
                  <View className="px-2 py-0.5 bg-ink-100 rounded-full">
                    <Text className="text-[10px] font-semibold text-ink-400 tracking-wide">PAST</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => setSelectedDate(item.date)}>
                  <Text className="text-xs text-ink-400">Show day</Text>
                </TouchableOpacity>
              </View>
            );
          }
          const past = whenOf(item.date) === "past";
          return (
            <TouchableOpacity onPress={() => setSheetItem(item)} activeOpacity={0.7}>
              {item.type === "event" ? (
                <Card variant="elevated" className={`flex-row items-center gap-3.5 mb-2.5 ${past ? "opacity-55" : ""}`}>
                  <View className="w-10 h-10 bg-black rounded-full items-center justify-center">
                    <Feather
                      name={sourceIcons[item.source || ""] || "calendar"}
                      size={16} color="#ffffff"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-ink-400 tracking-widest mb-0.5">EVENT</Text>
                    <Text className="text-sm font-medium text-black">{item.title}</Text>
                    {item.description && (
                      <Text className="text-xs text-ink-500 mt-0.5" numberOfLines={1}>{item.description}</Text>
                    )}
                    <View className="flex-row items-center gap-2 mt-1">
                      <Feather name="clock" size={10} color="#999999" />
                      <Text className="text-xs text-ink-400">{item.time}</Text>
                      <Text className="text-xs text-ink-200">·</Text>
                      <Text className="text-xs text-ink-400 capitalize">{item.source}</Text>
                    </View>
                  </View>
                  <Feather name="chevron-up" size={14} color="#cccccc" />
                </Card>
              ) : (
                <Card variant="elevated" className={`flex-row items-center gap-3.5 mb-2.5 ${past && !item.completed ? "opacity-55" : ""}`}>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); if (item.todoId) toggleTodo(item.todoId); }}
                    className={`w-7 h-7 rounded-md border-2 items-center justify-center ${
                      item.completed ? "bg-black border-black" : "border-ink-300"
                    }`}
                  >
                    {item.completed && <Feather name="check" size={14} color="#ffffff" />}
                  </TouchableOpacity>
                  <View className="flex-1">
                    <Text className="text-[10px] font-bold text-ink-400 tracking-widest mb-0.5">TODO</Text>
                    <Text className={`text-sm ${item.completed ? "line-through text-ink-300" : "text-black"}`}>
                      {item.title}
                    </Text>
                    <Text className="text-xs text-ink-300 mt-0.5">
                      {item.date ? new Date(item.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : ""}
                      {item.priority ? ` · ${item.priority}` : ""}
                    </Text>
                  </View>
                  <Feather name="chevron-up" size={14} color="#cccccc" />
                </Card>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            title="Nothing this day"
            subtitle="Tap + to add an event or todo"
          />
        }
      />

      {sheetItem && (
        <ItemSheet
          {...(sheetItem.type === "event" ? {
            event: {
              id: sheetItem.id,
              title: sheetItem.title,
              date: sheetItem.date,
              time: sheetItem.time,
              description: sheetItem.description,
              source: sheetItem.source,
              notes: sheetItem.notes,
              eventId: sheetItem.eventId,
            },
            onEventDelete: (id) => { deleteEvent(id); setSheetItem(null); },
          } : {
            todo: {
              id: sheetItem.id,
              title: sheetItem.title,
              date: sheetItem.date,
              priority: sheetItem.priority,
              completed: sheetItem.completed,
              todoId: sheetItem.todoId,
            },
            onTodoToggle: (id) => { toggleTodo(id); setSheetItem(null); },
            onTodoDelete: (id) => { setSheetItem(null); },
          })}
          onClose={() => setSheetItem(null)}
        />
      )}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-sheet px-5 pt-3 pb-10 shadow-float">
            <View className="w-10 h-1 bg-ink-200 rounded-full self-center mb-5" />
            <View className="flex-row justify-between items-center mb-5">
              <Text className="text-lg font-semibold tracking-tightest text-black">New Event</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} className="w-8 h-8 bg-ink-100 rounded-full items-center justify-center">
                <Feather name="x" size={16} color="#666666" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-medium text-ink-400 mb-1.5">Title</Text>
            <TextInput
              className="h-12 bg-ink-50 rounded-xl px-4 text-sm text-black mb-4"
              placeholder="Event title"
              placeholderTextColor="#999999"
              value={eventTitle}
              onChangeText={setEventTitle}
            />

            <Text className="text-xs font-medium text-ink-400 mb-1.5">Date</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="h-12 bg-ink-50 rounded-xl px-4 items-center flex-row mb-4"
            >
              <Feather name="calendar" size={14} color="#666666" />
              <Text className="text-sm text-black ml-2">{eventDate.toLocaleDateString()}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={eventDate}
                mode="date"
                onChange={onDateChange}
              />
            )}

            <Text className="text-xs font-medium text-ink-400 mb-1.5">Time</Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              className="h-12 bg-ink-50 rounded-xl px-4 items-center flex-row mb-6"
            >
              <Feather name="clock" size={14} color="#666666" />
              <Text className="text-sm text-black ml-2">
                {eventTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </TouchableOpacity>

            {showTimePicker && (
              <DateTimePicker
                value={eventTime}
                mode="time"
                onChange={onTimeChange}
              />
            )}

            <Text className="text-xs font-medium text-ink-400 mb-1.5">Notes</Text>
            <TextInput
              className="min-h-[72px] bg-ink-50 rounded-xl px-4 py-3 text-sm text-black mb-6"
              placeholder="Add notes for this event"
              placeholderTextColor="#999999"
              value={eventNotes}
              onChangeText={setEventNotes}
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              onPress={saveEvent}
              activeOpacity={0.85}
              className="bg-black h-12 rounded-xl items-center justify-center shadow-raised"
            >
              <Text className="text-white text-base font-semibold">Save Event</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <SheetModal
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title="Add to Calendar"
        message="Choose how to add"
        options={[
          { icon: "calendar", label: "Add Event", onPress: () => { resetForm(); setShowModal(true); } },
          { icon: "check-square", label: "Add Todo", onPress: () => router.push("/todo") },
          { icon: "file-text", label: "New Note", onPress: () => router.push("/note") },
          { icon: "camera", label: "Scan Image", onPress: () => { resetForm(); pickImageForOcr(); } },
        ]}
      />
      <SheetModal
        visible={showNoTextAlert}
        onClose={() => setShowNoTextAlert(false)}
        title="No text found"
        message="Could not extract text from image."
      />
      <SheetModal
        visible={showOcrError}
        onClose={() => setShowOcrError(false)}
        title="OCR failed"
        message="The image could not be processed. Try a clearer photo."
      />
      <SheetModal
        visible={showMissingTitle}
        onClose={() => setShowMissingTitle(false)}
        title="Missing title"
        message="Enter an event title."
      />
    </View>
  );
}

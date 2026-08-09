import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, TouchableOpacity, FlatList, TextInput, ScrollView, Platform, useWindowDimensions,
} from "react-native";
import BottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";

import { router } from "expo-router";
import { uid } from "@/utils/id";
import { SheetModal } from "@/components/ui/SheetModal";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { PickerModal } from "@/components/ui/PickerModal";
import { Calendar, LocaleConfig } from "react-native-calendars";
import type { Theme } from "react-native-calendars/src/types";

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
import { useCalendarStore, CalendarEvent, Recurrence } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { occursOnDate, expandOccurrences, dateKey, keyToDate } from "@/utils/recurrence";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ItemSheet } from "@/components/ItemSheet";
import { cancelEventReminder } from "@/services/notification-service";
import { loadEventDraft, saveEventDraft, clearEventDraft } from "@/utils/drafts";
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
  recurrence?: Recurrence;
  reminder?: number;
}

const sourceIcons: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  manual: "edit-2", ocr: "camera", email: "mail",
  notification: "bell", chat: "message-circle", ai: "cpu",
};

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

const todayStr = new Date().toLocaleDateString("en-CA");
type WhenKind = "past" | "today" | "future";
function whenOf(date: string): WhenKind {
  if (date < todayStr) return "past";
  if (date === todayStr) return "today";
  return "future";
}

const rangeFrom = new Date();
rangeFrom.setDate(rangeFrom.getDate() - 90);
const rangeTo = new Date();
rangeTo.setDate(rangeTo.getDate() + 366);
const VISIBLE_RANGE = { from: dateKey(rangeFrom), to: dateKey(rangeTo) };

function eventToItem(e: CalendarEvent, date: string): CalendarItem {
  return {
    id: e.id,
    type: "event",
    title: e.title,
    description: e.description,
    date,
    time: new Date(e.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    source: e.source,
    notes: e.notes,
    eventId: e.id,
    recurrence: e.recurrence,
    reminder: e.reminder,
  };
}

type RepeatMode = "none" | "daily" | "weekdays" | "everyday" | "weekly" | "monthly" | "custom";

const REPEAT_OPTIONS: { key: RepeatMode; label: string }[] = [
  { key: "none", label: "None" },
  { key: "daily", label: "Daily" },
  { key: "weekdays", label: "Mon–Fri" },
  { key: "everyday", label: "Mon–Sun" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "custom", label: "Custom" },
];

function buildRecurrence(mode: RepeatMode, weekdays: number[]): Recurrence | undefined {
  switch (mode) {
    case "daily":
      return { frequency: "daily", interval: 1 };
    case "weekdays":
      return { frequency: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] };
    case "everyday":
      return { frequency: "weekly", interval: 1, weekdays: [0, 1, 2, 3, 4, 5, 6] };
    case "weekly":
      return { frequency: "weekly", interval: 1 };
    case "monthly":
      return { frequency: "monthly", interval: 1 };
    case "custom":
      return weekdays.length > 0 ? { frequency: "weekly", interval: 1, weekdays: [...weekdays].sort() } : undefined;
    default:
      return undefined;
  }
}

const CALENDAR_BASE_THEME = {
  todayTextColor: "#000000",
  selectedDayBackgroundColor: "#000000",
  selectedDayTextColor: "#ffffff",
  arrowColor: "#000000",
  monthTextColor: "#000000",
  textMonthFontWeight: "600",
  textMonthFontSize: 15,
  textDayFontSize: 12,
  textDayHeaderFontSize: 11,
  weekVerticalMargin: 1,
  "stylesheet.calendar.main": {
    week: { marginVertical: 1, flexDirection: "row", justifyContent: "space-around" },
  },
  "stylesheet.day.basic": {
    base: { width: 30, height: 22, alignItems: "center" },
    selected: { backgroundColor: "#000000", borderRadius: 11, width: 22, height: 22 },
    today: { backgroundColor: "#eeeeee", borderRadius: 11, width: 22, height: 22 },
    text: { fontSize: 12, fontWeight: "400", color: "#000000", marginTop: 2 },
  },
} as unknown as Theme;

function shiftMonthKey(key: string, delta: number): string {
  const d = new Date(key + "T12:00:00");
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return dateKey(d);
}

export default function CalendarScreen() {
  const events = useCalendarStore((s) => s.events);
  const selectedDate = useCalendarStore((s) => s.selectedDate);
  const loadEvents = useCalendarStore((s) => s.loadEvents);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const setSelectedDate = useCalendarStore((s) => s.setSelectedDate);
  const todos = useTodoStore((s) => s.todos);
  const loadTodos = useTodoStore((s) => s.loadTodos);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);

  const [showAll, setShowAll] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [viewMonth, setViewMonth] = useState(selectedDate || todayStr);
  const calendarHeight = Math.max(168, Math.round(windowHeight * 0.25));

  useEffect(() => {
    loadEvents();
    loadTodos();
  }, []);

  const allItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];
    for (const e of events) {
      for (const d of expandOccurrences(e, VISIBLE_RANGE.from, VISIBLE_RANGE.to)) {
        items.push({ ...eventToItem(e, d), id: `${e.id}:${d}` });
      }
    }
    for (const t of todos) {
      if (!t.dueDate) continue;
      items.push({
        id: `todo-${t.id}`,
        type: "todo",
        title: t.title,
        date: t.dueDate.split("T")[0],
        priority: t.priority,
        completed: t.completed,
        todoId: t.id,
      });
    }
    return items;
  }, [events, todos]);

  const showAllItems = useMemo(() => sortItems(allItems), [allItems]);

  const dayItems = useMemo(() => {
    const items: CalendarItem[] = [];
    for (const e of events) {
      if (occursOnDate(e, selectedDate)) items.push(eventToItem(e, selectedDate));
    }
    for (const t of todos) {
      if (t.dueDate && t.dueDate.split("T")[0] === selectedDate) {
        items.push({
          id: `todo-${t.id}`,
          type: "todo",
          title: t.title,
          date: selectedDate,
          priority: t.priority,
          completed: t.completed,
          todoId: t.id,
        });
      }
    }
    return sortItems(items);
  }, [events, todos, selectedDate]);

  const displayItems = useMemo(
    () => (showAll || !selectedDate ? buildSections(showAllItems) : dayItems),
    [showAll, selectedDate, showAllItems, dayItems],
  );

  const markedDates = useMemo(() => {
    const m: Record<string, any> = {};
    allItems.forEach((item) => {
      if (!m[item.date]) {
        m[item.date] = { marked: true, _hasEvent: false, _hasTodo: false };
      }
      if (item.type === "event") m[item.date]._hasEvent = true;
      else m[item.date]._hasTodo = true;
    });
    Object.keys(m).forEach((d) => {
      const dots: { key: string; color: string }[] = [];
      if (m[d]._hasEvent) dots.push({ key: "event", color: "#000000" });
      if (m[d]._hasTodo) dots.push({ key: "todo", color: "#999999" });
      m[d].dots = dots;
      delete m[d]._hasEvent;
      delete m[d]._hasTodo;
    });
    if (selectedDate) {
      m[selectedDate] = {
        ...(m[selectedDate] || { dots: [], marked: true }),
        selected: true,
        selectedColor: "#000000",
      };
    }
    return m;
  }, [allItems, selectedDate]);

  const todoDatesCount = useMemo(
    () => todos.reduce((n, t) => n + (t.dueDate ? 1 : 0), 0),
    [todos],
  );

  const [sheetItem, setSheetItem] = useState<CalendarItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sheetMode, setSheetMode] = useState<"menu" | "form">("menu");
  const [eventTitle, setEventTitle] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [eventTime, setEventTime] = useState(new Date());
  const [eventEndTime, setEventEndTime] = useState(new Date(Date.now() + 3600000));
  const [pickerMode, setPickerMode] = useState<"date" | "time" | "endTime" | null>(null);
  const [showMissingTitle, setShowMissingTitle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<0 | 15 | 30 | 60>(0);

  const resetForm = useCallback(() => {
    setEventTitle("");
    setEventNotes("");
    setEventDate(new Date());
    setEventTime(new Date());
    setEventEndTime(new Date(Date.now() + 3600000));
    setRepeatMode("none");
    setCustomWeekdays([]);
    setReminderMinutes(0);
  }, []);

  // Restore the last in-progress event draft into the form.
  const hydrateDraft = useCallback(() => {
    const draft = loadEventDraft();
    setEventTitle(draft.title ?? "");
    setEventNotes(draft.notes ?? "");
    if (draft.startDate) {
      const d = new Date(draft.startDate);
      if (!isNaN(d.getTime())) {
        setEventDate(d);
        setEventTime(d);
      }
    }
    if (draft.endDate) {
      const d = new Date(draft.endDate);
      if (!isNaN(d.getTime())) setEventEndTime(d);
      else setEventEndTime(new Date(new Date(draft.startDate ?? Date.now()).getTime() + 3600000));
    } else if (draft.startDate && !isNaN(new Date(draft.startDate).getTime())) {
      setEventEndTime(new Date(new Date(draft.startDate).getTime() + 3600000));
    }
    setRepeatMode((draft.repeatMode as RepeatMode) ?? "none");
    setCustomWeekdays(draft.customWeekdays ?? []);
    const validReminders: (0 | 15 | 30 | 60)[] = [0, 15, 30, 60];
    setReminderMinutes(
      validReminders.includes(draft.reminderMinutes as 0 | 15 | 30 | 60)
        ? (draft.reminderMinutes as 0 | 15 | 30 | 60)
        : 0
    );
  }, []);

  // Autosave the event draft while the form is open, so closing the sheet
  // keeps everything typed.
  useEffect(() => {
    if (sheetMode !== "form") return;
    const start = new Date(eventDate);
    start.setHours(eventTime.getHours(), eventTime.getMinutes(), 0, 0);
    const end = new Date(eventDate);
    end.setHours(eventEndTime.getHours(), eventEndTime.getMinutes(), 0, 0);
    if (end <= start) end.setTime(start.getTime() + 3600000);
    saveEventDraft({
      title: eventTitle,
      notes: eventNotes,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      repeatMode: repeatMode === "none" ? undefined : repeatMode,
      customWeekdays: customWeekdays.length ? customWeekdays : undefined,
      reminderMinutes: reminderMinutes || undefined,
    });
  }, [eventTitle, eventNotes, eventDate, eventTime, eventEndTime, repeatMode, customWeekdays, reminderMinutes, sheetMode]);

  const toggleWeekday = useCallback((d: number) => {
    setCustomWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }, []);

  const saveEvent = useCallback(() => {
    if (!eventTitle.trim()) {
      setShowMissingTitle(true);
      return;
    }
    const start = new Date(eventDate);
    start.setHours(eventTime.getHours(), eventTime.getMinutes(), 0, 0);
    const end = new Date(eventDate);
    end.setHours(eventEndTime.getHours(), eventEndTime.getMinutes(), 0, 0);
    if (end <= start) end.setTime(start.getTime() + 3600000);
    addEvent({
      id: uid("manual-evt"),
      title: eventTitle.trim(),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      source: "manual",
      notes: eventNotes.trim() || undefined,
      recurrence: buildRecurrence(repeatMode, customWeekdays),
      reminder: reminderMinutes > 0 ? reminderMinutes : undefined,
    });
    setShowModal(false);
    setSheetMode("menu");
    clearEventDraft();
    resetForm();
  }, [eventTitle, eventDate, eventTime, eventEndTime, eventNotes, repeatMode, customWeekdays, reminderMinutes, addEvent, resetForm]);

  const onDayPress = useCallback((day: { dateString: string }) => {
    setSelectedDate(day.dateString);
  }, [setSelectedDate]);

  const onDayLongPress = useCallback((day: { dateString: string }) => {
    const d = new Date(day.dateString + "T00:00:00");
    setEventDate(d);
    setSelectedDate(day.dateString);
    setSheetMode("form");
    setShowModal(true);
  }, [setSelectedDate]);

  const renderItem = useCallback(
    ({ item }: { item: { kind: "date-header"; date: string; label: string } | CalendarItem }) => {
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
                  {item.recurrence && (
                    <>
                      <Text className="text-xs text-ink-200">·</Text>
                      <Feather name="repeat" size={10} color="#999999" />
                    </>
                  )}
                  {item.reminder && (
                    <>
                      <Text className="text-xs text-ink-200">·</Text>
                      <Feather name="bell" size={10} color="#999999" />
                      <Text className="text-xs text-ink-400">{item.reminder}min</Text>
                    </>
                  )}
                </View>
              </View>
              <Feather name="chevron-up" size={14} color="#cccccc" />
            </Card>
          ) : (
            <Card variant="elevated" className={`flex-row items-center gap-3.5 mb-2.5 ${past && !item.completed ? "opacity-55" : ""}`}>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); if (item.todoId) toggleTodo(item.todoId); }}
                className={`w-7 h-7 rounded-md border-2 items-center justify-center ${item.completed ? "bg-black border-black" : "border-ink-300"
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
    },
    [setSelectedDate, setSheetItem, toggleTodo],
  );

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-semibold tracking-tightest text-black">Calendar</Text>
          <Text className="text-sm text-ink-500 mt-1">
            {events.length} events · {todoDatesCount} todo dates
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => { resetForm(); setSheetMode("menu"); setShowModal(true); }}
          activeOpacity={0.85}
          className="w-11 h-11 bg-black rounded-full items-center justify-center shadow-raised"
        >
          <Feather name="plus" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View className="px-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => setCalendarExpanded((v) => !v)}
          className="flex-row items-center gap-1.5 py-1"
          activeOpacity={0.7}
        >
          <Text className="text-base font-semibold tracking-tight text-black">
            {new Date(viewMonth + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </Text>
          <Feather name={calendarExpanded ? "chevron-up" : "chevron-down"} size={16} color="#999999" />
        </TouchableOpacity>
        <View className="flex-row items-center gap-1.5">
          {viewMonth !== todayStr && (
            <TouchableOpacity
              onPress={() => { setViewMonth(todayStr); setSelectedDate(todayStr); }}
              className="px-2.5 py-1 rounded-full bg-ink-100"
              activeOpacity={0.7}
            >
              <Text className="text-[11px] font-semibold text-ink-600">Today</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setViewMonth((m) => shiftMonthKey(m, -1))}
            className="w-7 h-7 bg-ink-100 rounded-full items-center justify-center"
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={14} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMonth((m) => shiftMonthKey(m, 1))}
            className="w-7 h-7 bg-ink-100 rounded-full items-center justify-center"
            activeOpacity={0.7}
          >
            <Feather name="chevron-right" size={14} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>

      {calendarExpanded && (
        <View style={{ height: calendarHeight, overflow: "hidden" }}>
          <Calendar
            current={viewMonth}
            onDayPress={onDayPress}
            onDayLongPress={onDayLongPress}
            onMonthChange={(d) => setViewMonth(d.dateString)}
            markedDates={markedDates}
            markingType="multi-dot"
            theme={CALENDAR_BASE_THEME}
            style={{ paddingBottom: 0 }}
          />
        </View>
      )}

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
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        renderItem={renderItem}
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
              id: sheetItem.eventId || sheetItem.id,
              title: sheetItem.title,
              date: sheetItem.date,
              time: sheetItem.time,
              description: sheetItem.description,
              source: sheetItem.source,
              notes: sheetItem.notes,
              eventId: sheetItem.eventId || sheetItem.id,
              recurrence: sheetItem.recurrence,
              reminder: sheetItem.reminder,
            },
            onEventDelete: (id) => { deleteEvent(id); cancelEventReminder(id); setSheetItem(null); },
          } : {
            todo: {
              id: sheetItem.todoId || sheetItem.id,
              title: sheetItem.title,
              date: sheetItem.date,
              priority: sheetItem.priority,
              completed: sheetItem.completed,
              todoId: sheetItem.todoId || sheetItem.id,
            },
            onTodoToggle: (id) => { toggleTodo(id); },
            onTodoDelete: (id) => { deleteTodo(id); setSheetItem(null); },
          })}
          onClose={() => setSheetItem(null)}
        />
      )}

      <BottomSheet
        enablePanDownToClose
        index={showModal ? 0 : -1}
        backgroundStyle={{ backgroundColor: "#ffffff" }}
        onChange={(index: number) => { if (index === -1) { setShowModal(false); setSheetMode("menu"); } }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 }}>
          {sheetMode === "menu" ? (
            <>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-lg font-semibold tracking-tightest text-black">Add to Calendar</Text>
              </View>

              <TouchableOpacity
                className="flex-row items-center gap-3 py-3.5 border-b border-ink-100"
                onPress={() => { resetForm(); hydrateDraft(); setSheetMode("form"); }}
              >
                <View className="w-10 h-10 bg-black rounded-full items-center justify-center">
                  <Feather name="calendar" size={16} color="#ffffff" />
                </View>
                <Text className="text-sm font-medium text-black">Add Event</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center gap-3 py-3.5 border-b border-ink-100"
                onPress={() => { setShowModal(false); router.push("/todo"); }}
              >
                <View className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
                  <Feather name="check-square" size={16} color="#000000" />
                </View>
                <Text className="text-sm font-medium text-black">Add Todo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row items-center gap-3 py-3.5"
                onPress={() => { setShowModal(false); router.push("/note"); }}
              >
                <View className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
                  <Feather name="file-text" size={16} color="#000000" />
                </View>
                <Text className="text-sm font-medium text-black">New Note</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="flex-row justify-between items-center mb-5">
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity onPress={() => setSheetMode("menu")} className="w-8 h-8 bg-ink-100 rounded-full items-center justify-center">
                    <Feather name="chevron-left" size={16} color="#666666" />
                  </TouchableOpacity>
                  <Text className="text-lg font-semibold tracking-tightest text-black">New Event</Text>
                </View>
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
                onPress={() => setPickerMode("date")}
                className="h-12 bg-ink-50 rounded-xl px-4 items-center flex-row mb-4"
              >
                <Feather name="calendar" size={14} color="#666666" />
                <Text className="text-sm text-black ml-2">{eventDate.toLocaleDateString()}</Text>
              </TouchableOpacity>

              <Text className="text-xs font-medium text-ink-400 mb-1.5">Time</Text>
              <TouchableOpacity
                onPress={() => setPickerMode("time")}
                className="h-12 bg-ink-50 rounded-xl px-4 items-center flex-row mb-3"
              >
                <Feather name="clock" size={14} color="#666666" />
                <Text className="text-sm text-black ml-2">
                  {eventTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </TouchableOpacity>

              <Text className="text-xs font-medium text-ink-400 mb-1.5">End time</Text>
              <TouchableOpacity
                onPress={() => setPickerMode("endTime")}
                className="h-12 bg-ink-50 rounded-xl px-4 items-center flex-row mb-6"
              >
                <Feather name="stop-circle" size={14} color="#666666" />
                <Text className="text-sm text-black ml-2">
                  {eventEndTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </TouchableOpacity>

              <Text className="text-xs font-medium text-ink-400 mb-1.5">Repeat</Text>
              <View className="flex-row flex-wrap gap-2 mb-2.5">
                {REPEAT_OPTIONS.map((o) => (
                  <Chip
                    key={o.key}
                    label={o.label}
                    active={repeatMode === o.key}
                    onPress={() => setRepeatMode(o.key)}
                  />
                ))}
              </View>

              {repeatMode === "custom" && (
                <View className="flex-row justify-between mb-6 px-1">
                  {["S", "M", "T", "W", "T", "F", "S"].map((label, d) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => toggleWeekday(d)}
                      className={`w-9 h-9 rounded-full items-center justify-center ${
                        customWeekdays.includes(d) ? "bg-black" : "bg-ink-100"
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text className={`text-xs font-semibold ${customWeekdays.includes(d) ? "text-white" : "text-ink-500"}`}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text className="text-xs font-medium text-ink-400 mb-1.5">Reminder</Text>
              <View className="flex-row flex-wrap gap-2 mb-6">
                {([
                  { value: 0, label: "None" },
                  { value: 15, label: "15 min before" },
                  { value: 30, label: "30 min before" },
                  { value: 60, label: "1 hr before" },
                ] as const).map((o) => (
                  <Chip
                    key={o.value}
                    label={o.label}
                    active={reminderMinutes === o.value}
                    onPress={() => setReminderMinutes(o.value)}
                  />
                ))}
              </View>

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
            </ScrollView>
          )}
        </BottomSheetView>
      </BottomSheet>

      {Platform.OS === "android" && pickerMode === "date" && (
        <DateTimePicker
          value={eventDate}
          mode="date"
          onChange={(_, d) => { setPickerMode(null); if (d) setEventDate(d); }}
        />
      )}
      {Platform.OS === "android" && pickerMode === "time" && (
        <DateTimePicker
          value={eventTime}
          mode="time"
          onChange={(_, d) => { setPickerMode(null); if (d) setEventTime(d); }}
        />
      )}
      {Platform.OS === "android" && pickerMode === "endTime" && (
        <DateTimePicker
          value={eventEndTime}
          mode="time"
          onChange={(_, d) => { setPickerMode(null); if (d) setEventEndTime(d); }}
        />
      )}

      <PickerModal
        visible={Platform.OS !== "android" && pickerMode !== null}
        title={pickerMode === "date" ? "Select Date" : pickerMode === "endTime" ? "Select End Time" : "Select Time"}
        mode={pickerMode === "date" ? "date" : "time"}
        value={pickerMode === "date" ? eventDate : pickerMode === "endTime" ? eventEndTime : eventTime}
        onConfirm={(d) => {
          if (pickerMode === "date") setEventDate(d);
          else if (pickerMode === "endTime") setEventEndTime(d);
          else setEventTime(d);
        }}
        onClose={() => setPickerMode(null)}
      />

      <AlertDialog
        visible={showMissingTitle}
        onClose={() => setShowMissingTitle(false)}
        title="Missing title"
        message="Enter an event title."
      />
    </View>
  );
}

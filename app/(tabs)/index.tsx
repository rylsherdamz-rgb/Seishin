import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { launchImageLibraryAsync } from "expo-image-picker";
import { router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { recognizeText } from "@/services/ocr";
import { cancelEventReminder } from "@/services/notification-service";
import { useColors } from "@/theme/ThemeProvider";
import { uid } from "@/utils/id";
import { ItemSheet } from "@/components/ItemSheet";
import { atMinutes, nextSlotMinutes, relativeDayLabel, shiftMonth, addDays, type CalendarItem, type QuickParse } from "@/components/calendar/calendar-utils";
import { CalendarHeader, DaySummary, ViewSwitcher, type CalendarView } from "@/components/calendar/CalendarHeader";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { WeekStrip } from "@/components/calendar/WeekStrip";
import { DayTimeline } from "@/components/calendar/DayTimeline";
import { AgendaList } from "@/components/calendar/AgendaList";
import { CreateSheet, type CreateKind } from "@/components/calendar/CreateSheet";
import { EventFormSheet } from "@/components/calendar/EventFormSheet";
import type { EventPrefill } from "@/components/calendar/useEventForm";
import { useCalendarData, useToday } from "@/components/calendar/useCalendarData";

/** Default start for a new event on `key`: next half-hour today, else 9 AM. */
function defaultStart(key: string, today: string): Date {
  return atMinutes(key, key === today ? nextSlotMinutes() : 9 * 60);
}

export default function CalendarScreen() {
  const C = useColors();
  const today = useToday();
  const selected = useCalendarStore((s) => s.selectedDate);
  const setSelected = useCalendarStore((s) => s.setSelectedDate);
  const loadEvents = useCalendarStore((s) => s.loadEvents);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const loadTodos = useTodoStore((s) => s.loadTodos);
  const addTodo = useTodoStore((s) => s.addTodo);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);

  const [view, setView] = useState<CalendarView>("day");
  const [expanded, setExpanded] = useState(false);
  const [viewMonth, setViewMonth] = useState(selected);
  const [sheetItem, setSheetItem] = useState<CalendarItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<EventPrefill | null>(null);
  const [scanning, setScanning] = useState(false);
  const { events, marks, dayItems, upcomingRows, summary } = useCalendarData(selected, viewMonth, today);

  useEffect(() => {
    loadEvents();
    loadTodos();
  }, [loadEvents, loadTodos]);

  const select = useCallback((key: string) => {
    setSelected(key);
    setViewMonth(key);
    if (view === "upcoming") setView("day");
  }, [setSelected, view]);

  const openForm = useCallback((key: string, minutes?: number, extra?: Partial<EventPrefill>) => {
    setSelected(key);
    setForm({ start: minutes === undefined ? defaultStart(key, today) : atMinutes(key, minutes), ...extra });
  }, [setSelected, today]);

  const openEdit = useCallback((id: string) => {
    const e = events.find((x) => x.id === id);
    if (!e) return;
    setForm({
      editingId: e.id, title: e.title, notes: e.notes ?? e.description,
      start: new Date(e.startDate), end: new Date(e.endDate), allDay: e.allDay,
      recurrence: e.recurrence, reminder: e.reminder, attachments: e.attachments,
    });
  }, [events]);

  const quickAdd = useCallback((kind: CreateKind, p: QuickParse) => {
    if (kind === "todo") {
      addTodo({
        id: uid("todo"), title: p.title, completed: false, priority: "medium", category: "general",
        tags: [], createdAt: new Date().toISOString(), dueDate: atMinutes(p.date, 12 * 60).toISOString(),
      });
    } else {
      const start = atMinutes(p.date, p.minutes ?? (p.date === today ? nextSlotMinutes() : 9 * 60));
      const end = new Date(start.getTime() + (p.duration ?? 60) * 60000);
      addEvent({ id: uid("manual-evt"), title: p.title, startDate: start.toISOString(), endDate: end.toISOString(), source: "manual" });
    }
    select(p.date);
  }, [addTodo, addEvent, today, select]);

  const scanToEvent = useCallback(async () => {
    try {
      const res = await launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (res.canceled || !res.assets[0]) return;
      setScanning(true);
      const text = (await recognizeText(res.assets[0].uri)).trim();
      const firstLine = text.split("\n").find((l) => l.trim())?.trim().slice(0, 60) ?? "";
      openForm(selected, undefined, { title: firstLine, notes: text });
    } catch {
      Alert.alert("Scan failed", "Couldn't read text from that image. Try a clearer photo.");
    } finally {
      setScanning(false);
    }
  }, [openForm, selected]);

  const shiftWeek = useCallback((d: 1 | -1) => select(addDays(selected, d * 7)), [select, selected]);
  const shiftMonthBy = useCallback((d: 1 | -1) => setViewMonth((m) => shiftMonth(m, d)), []);

  return (
    <View className="flex-1 bg-white">
      <CalendarHeader
        month={expanded ? viewMonth : selected}
        expanded={expanded}
        showToday={selected !== today || (expanded && viewMonth.slice(0, 7) !== today.slice(0, 7))}
        onToggleExpanded={() => { setViewMonth(selected); setExpanded((v) => !v); }}
        onToday={() => select(today)}
        onShiftMonth={shiftMonthBy}
      />

      {expanded ? (
        <MonthGrid
          month={viewMonth}
          selected={selected}
          today={today}
          marks={marks}
          onSelect={select}
          onLongPress={(k) => openForm(k)}
          onSwipe={shiftMonthBy}
        />
      ) : (
        <WeekStrip selected={selected} today={today} marks={marks} onSelect={select} onLongPress={(k) => openForm(k)} onSwipe={shiftWeek} />
      )}

      <View className="h-3" />
      <ViewSwitcher value={view} onChange={setView} />

      {view === "upcoming" ? (
        <AgendaList
          rows={upcomingRows}
          today={today}
          emptyTitle="Nothing coming up"
          emptySubtitle="Your next 60 days are wide open. Tap + to plan something."
          onOpen={setSheetItem}
          onToggleTodo={toggleTodo}
          onShowDay={select}
        />
      ) : (
        <Animated.View key={selected + view} entering={FadeIn.duration(160)} className="flex-1">
          <DaySummary label={relativeDayLabel(selected, today)} {...summary} />
          {view === "day" ? (
            <DayTimeline
              date={selected}
              today={today}
              items={dayItems}
              onOpen={setSheetItem}
              onToggleTodo={toggleTodo}
              onCreateAt={(m) => openForm(selected, m)}
            />
          ) : (
            <AgendaList
              rows={dayItems}
              today={today}
              emptyTitle="Nothing planned"
              emptySubtitle="Tap + to add an event or task, or long-press a day."
              onOpen={setSheetItem}
              onToggleTodo={toggleTodo}
              onShowDay={select}
            />
          )}
        </Animated.View>
      )}

      <Animated.View entering={ZoomIn.delay(150).duration(250)} className="absolute right-5 bottom-5">
        <TouchableOpacity
          onPress={() => setCreateOpen(true)}
          activeOpacity={0.85}
          className="w-14 h-14 rounded-2xl bg-accent items-center justify-center shadow-float"
          accessibilityLabel="Create"
        >
          <Feather name="plus" size={26} color={C.onAccent} />
        </TouchableOpacity>
      </Animated.View>

      {scanning && (
        <View className="absolute inset-0 items-center justify-center bg-white/80">
          <ActivityIndicator size="large" color={C.accent} />
          <Text className="text-sm font-semibold text-ink-600 mt-3">Reading your schedule…</Text>
        </View>
      )}

      {createOpen && (
        <CreateSheet
          date={selected}
          onClose={() => setCreateOpen(false)}
          onQuickAdd={quickAdd}
          onNewEvent={() => openForm(selected, undefined, { fromDraft: true })}
          onTemplate={(title, mins) => {
            const start = defaultStart(selected, today);
            setForm({ start, end: new Date(start.getTime() + mins * 60000), title });
          }}
          onNewTodo={() => router.push("/todo")}
          onNewNote={() => router.push("/note")}
          onScan={scanToEvent}
        />
      )}

      {form && <EventFormSheet prefill={form} onClose={() => setForm(null)} />}

      {sheetItem && (
        <ItemSheet
          {...(sheetItem.type === "event"
            ? {
                event: { ...sheetItem, id: sheetItem.eventId || sheetItem.id, eventId: sheetItem.eventId || sheetItem.id },
                onEventDelete: (id: string) => { deleteEvent(id); cancelEventReminder(id); setSheetItem(null); },
                onEventEdit: (ev: { id: string }) => { setSheetItem(null); openEdit(ev.id); },
              }
            : {
                todo: { ...sheetItem, id: sheetItem.todoId || sheetItem.id, todoId: sheetItem.todoId || sheetItem.id },
                onTodoToggle: (id: string) => toggleTodo(id),
                onTodoDelete: (id: string) => { deleteTodo(id); setSheetItem(null); },
              })}
          onClose={() => setSheetItem(null)}
        />
      )}
    </View>
  );
}

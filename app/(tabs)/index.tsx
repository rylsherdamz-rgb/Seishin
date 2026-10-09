import { useState, useEffect, useCallback } from "react";
import { View, Alert } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { router } from "expo-router";

import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { COPY } from "@/constants/copy";
import { atMinutes, nextSlotMinutes, relativeDayLabel, shiftMonth, addDays, type CalendarItem, type QuickParse } from "@/components/calendar/calendar-utils";
import { quickCreate, type CreateKind } from "@/components/calendar/actions";
import { CalendarItemSheet } from "@/components/calendar/CalendarItemSheet";
import { Fab } from "@/components/ui/Fab";
import { CalendarHeader, DaySummary, ViewSwitcher, type CalendarView } from "@/components/calendar/CalendarHeader";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { WeekStrip } from "@/components/calendar/WeekStrip";
import { DayTimeline } from "@/components/calendar/DayTimeline";
import { AgendaList } from "@/components/calendar/AgendaList";
import { CreateSheet } from "@/components/calendar/CreateSheet";
import { EventFormSheet } from "@/components/calendar/EventFormSheet";
import type { EventPrefill } from "@/components/calendar/useEventForm";
import { useCalendarData, useToday } from "@/components/calendar/useCalendarData";

/** Default start for a new event on `key`: next half-hour today, else 9 AM. */
function defaultStart(key: string, today: string): Date {
  return atMinutes(key, key === today ? nextSlotMinutes() : 9 * 60);
}

export default function CalendarScreen() {
  const today = useToday();
  const selected = useCalendarStore((s) => s.selectedDate);
  const setSelected = useCalendarStore((s) => s.setSelectedDate);
  const loadEvents = useCalendarStore((s) => s.loadEvents);
  const loadTodos = useTodoStore((s) => s.loadTodos);
  const toggleTodo = useTodoStore((s) => s.toggleTodo);

  const [view, setView] = useState<CalendarView>("day");
  const [expanded, setExpanded] = useState(false);
  const [viewMonth, setViewMonth] = useState(selected);
  const [sheetItem, setSheetItemRaw] = useState<CalendarItem | null>(null);
  // Tasks open their full screen (checklist, reminders, source photos); events use the sheet.
  const setSheetItem = useCallback((item: CalendarItem | null) => {
    if (item?.type === "todo" && item.todoId) router.push({ pathname: "/task", params: { id: item.todoId } });
    else setSheetItemRaw(item);
  }, []);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<EventPrefill | null>(null);
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
    if (!quickCreate(kind, p, today)) {
      Alert.alert(COPY.errors.saveFailedTitle, kind === "todo" ? COPY.errors.saveTaskFailed : COPY.errors.saveEventFailed);
      return;
    }
    select(p.date);
  }, [today, select]);


  // Stable handlers: inline lambdas here would defeat the memoized day cells.
  const openDay = useCallback((key: string) => openForm(key), [openForm]);
  const createAt = useCallback((m: number) => openForm(selected, m), [openForm, selected]);
  const openCreate = useCallback(() => setCreateOpen(true), []);

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
          onLongPress={openDay}
          onSwipe={shiftMonthBy}
        />
      ) : (
        <WeekStrip selected={selected} today={today} marks={marks} onSelect={select} onLongPress={openDay} onSwipe={shiftWeek} />
      )}

      <View className="h-3" />
      <ViewSwitcher value={view} onChange={setView} />

      {view === "upcoming" ? (
        <AgendaList
          rows={upcomingRows}
          today={today}
          emptyTitle={COPY.calendar.emptyUpcomingTitle}
          emptySubtitle={COPY.calendar.emptyUpcomingSubtitle}
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
              onCreateAt={createAt}
            />
          ) : (
            <AgendaList
              rows={dayItems}
              today={today}
              emptyTitle={COPY.calendar.emptyDayTitle}
              emptySubtitle={COPY.calendar.emptyDaySubtitle}
              onOpen={setSheetItem}
              onToggleTodo={toggleTodo}
              onShowDay={select}
            />
          )}
        </Animated.View>
      )}

      <Fab label={COPY.calendar.createFab} onPress={openCreate} />


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
          onScan={() => router.push("/capture")}
        />
      )}

      {form && <EventFormSheet prefill={form} onClose={() => setForm(null)} />}

      {sheetItem && <CalendarItemSheet item={sheetItem} onClose={() => setSheetItem(null)} onEdit={openEdit} />}
    </View>
  );
}

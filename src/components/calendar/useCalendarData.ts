import { useEffect, useMemo, useState } from "react";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore, type Todo } from "@/stores/todo-store";
import { dateKey, expandOccurrences, occursOnDate } from "@/utils/recurrence";
import {
  addDays, buildSections, eventToItem, minutesOf, sortItems, todoToItem,
  type AgendaRow, type CalendarItem,
} from "./calendar-utils";
import type { DayMarks } from "./MonthGrid";

/** Local day of a todo's due date (ISO strings are UTC, so don't just split). */
export function todoDay(t: Todo): string | null {
  if (!t.dueDate) return null;
  const d = new Date(t.dueDate);
  return isNaN(d.getTime()) ? t.dueDate.split("T")[0] : dateKey(d);
}

/** Today's date key, refreshed each minute so the view rolls over at midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => dateKey(new Date()));
  useEffect(() => {
    const t = setInterval(() => setToday(dateKey(new Date())), 60000);
    return () => clearInterval(t);
  }, []);
  return today;
}

export function useCalendarData(selected: string, viewMonth: string, today: string) {
  const events = useCalendarStore((s) => s.events);
  const todos = useTodoStore((s) => s.todos);

  // Dots for the visible month grid (± a week for the leading/trailing days).
  const marks = useMemo(() => {
    const from = addDays(viewMonth.slice(0, 8) + "01", -7);
    const to = addDays(viewMonth.slice(0, 8) + "28", 21);
    const lo = from < addDays(selected, -7) ? from : addDays(selected, -7);
    const hi = to > addDays(selected, 7) ? to : addDays(selected, 7);
    const m: Record<string, DayMarks> = {};
    const bump = (k: string, field: keyof DayMarks) => {
      m[k] = m[k] ?? { events: 0, todos: 0 };
      m[k][field] += 1;
    };
    for (const e of events) for (const d of expandOccurrences(e, lo, hi)) bump(d, "events");
    for (const t of todos) {
      const d = todoDay(t);
      if (d && d >= lo && d <= hi && !t.completed) bump(d, "todos");
    }
    return m;
  }, [events, todos, viewMonth, selected]);

  const dayItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];
    for (const e of events) if (occursOnDate(e, selected)) items.push(eventToItem(e, selected));
    for (const t of todos) if (todoDay(t) === selected) items.push(todoToItem(t, selected));
    return sortItems(items);
  }, [events, todos, selected]);

  const upcomingRows = useMemo<AgendaRow[]>(() => {
    const to = addDays(today, 60);
    const items: CalendarItem[] = [];
    for (const e of events) {
      for (const d of expandOccurrences(e, today, to, 60)) items.push({ ...eventToItem(e, d), id: `${e.id}:${d}` });
    }
    for (const t of todos) {
      const d = todoDay(t);
      // Overdue open tasks surface under today so they aren't forgotten.
      if (d && !t.completed && d <= to) items.push(todoToItem(t, d < today ? today : d));
    }
    return buildSections(sortItems(items));
  }, [events, todos, today]);

  const summary = useMemo(() => {
    const evs = dayItems.filter((i) => i.type === "event");
    const tasks = dayItems.filter((i) => i.type === "todo");
    const booked = evs.reduce((sum, i) => {
      if (i.allDay) return sum;
      const s = minutesOf(i.startDate);
      const e = minutesOf(i.endDate);
      return s !== null && e !== null && e > s ? sum + (e - s) : sum;
    }, 0);
    return { events: evs.length, tasks: tasks.length, done: tasks.filter((t) => t.completed).length, booked };
  }, [dayItems]);

  return { events, marks, dayItems, upcomingRows, summary };
}

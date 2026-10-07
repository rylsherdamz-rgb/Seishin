import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Pressable } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { formatDuration, type CalendarItem } from "./calendar-utils";
import { layoutEvents, type PlacedEvent } from "./timeline-layout";

export const HOUR_H = 60;
const GUTTER = 52;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

interface DayTimelineProps {
  date: string;
  today: string;
  items: CalendarItem[];
  onOpen: (item: CalendarItem) => void;
  onToggleTodo: (todoId: string) => void;
  onCreateAt: (minutes: number) => void;
}

function hourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "Noon";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function useNowMinutes(): number {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
}

/** Hour-by-hour day view with overlapping-event columns and a live "now" line. */
export function DayTimeline({ date, today, items, onOpen, onToggleTodo, onCreateAt }: DayTimelineProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const nowMin = useNowMinutes();
  const isToday = date === today;

  const timed = useMemo(() => items.filter((i) => i.type === "event" && !i.allDay), [items]);
  const untimed = useMemo(() => items.filter((i) => i.type === "todo" || i.allDay), [items]);
  const placed = useMemo(() => layoutEvents(timed), [timed]);

  // Land on something useful: now (today), the first event, or 8 AM.
  useEffect(() => {
    const first = placed.length ? Math.min(...placed.map((p) => p.start)) : null;
    const target = isToday ? nowMin - 90 : first !== null ? first - 30 : 8 * 60;
    const y = Math.max(0, (target / 60) * HOUR_H);
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 0);
    return () => clearTimeout(t);
    // Only on day change — not every minute tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, placed.length]);

  return (
    <View className="flex-1">
      {untimed.length > 0 && <UntimedBand items={untimed} onOpen={onOpen} onToggleTodo={onToggleTodo} />}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: HOUR_H * 24 + 12 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {HOURS.map((h) => (
            <HourRow key={h} hour={h} onPress={(half) => onCreateAt(h * 60 + (half ? 30 : 0))} />
          ))}
          {width > 0 &&
            placed.map((p) => (
              <EventBlock
                key={p.item.id}
                placed={p}
                width={width - GUTTER - 12}
                past={date < today || (isToday && p.end < nowMin)}
                onPress={() => onOpen(p.item)}
              />
            ))}
          {isToday && <NowLine minutes={nowMin} />}
        </View>
      </ScrollView>
    </View>
  );
}

function HourRow({ hour, onPress }: { hour: number; onPress: (half: boolean) => void }) {
  return (
    <Pressable
      onPress={(e) => onPress(e.nativeEvent.locationY > HOUR_H / 2)}
      className="flex-row active:bg-ink-25"
      style={{ position: "absolute", top: hour * HOUR_H + 6, left: 0, right: 0, height: HOUR_H }}
    >
      <Text className="text-[10px] font-medium text-ink-300 text-right pr-2" style={{ width: GUTTER, marginTop: -6 }}>
        {hour === 0 ? "" : hourLabel(hour)}
      </Text>
      <View className="flex-1 border-t border-ink-75" />
    </Pressable>
  );
}

function EventBlock({ placed, width, past, onPress }: { placed: PlacedEvent; width: number; past: boolean; onPress: () => void }) {
  const { item, start, end, col, cols } = placed;
  const colW = width / cols;
  const height = ((end - start) / 60) * HOUR_H - 2;
  const compact = height < 40;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className={`absolute rounded-lg bg-accent/15 border-l-[3px] border-accent px-2 overflow-hidden ${past ? "opacity-50" : ""}`}
      style={{ top: (start / 60) * HOUR_H + 7, left: GUTTER + col * colW + 2, width: colW - 4, height }}
    >
      <View className={compact ? "flex-row items-center gap-1.5 flex-1" : "pt-1"}>
        <Text className="text-[13px] font-semibold text-black" numberOfLines={compact ? 1 : 2}>
          {item.title}
        </Text>
        <Text className="text-[11px] text-ink-500" numberOfLines={1}>
          {item.time}
          {!compact && item.endTime ? ` – ${item.endTime}` : ""}
          {!compact && cols === 1 ? ` · ${formatDuration(end - start)}` : ""}
        </Text>
        {!compact && height > 80 && item.notes ? (
          <Text className="text-[11px] text-ink-400 mt-1" numberOfLines={Math.floor((height - 50) / 15)}>
            {item.notes}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function NowLine({ minutes }: { minutes: number }) {
  return (
    <View
      pointerEvents="none"
      className="absolute flex-row items-center"
      style={{ top: (minutes / 60) * HOUR_H + 6 - 4, left: GUTTER - 5, right: 0 }}
    >
      <View className="w-2.5 h-2.5 rounded-full bg-danger" />
      <View className="flex-1 h-[1.5px] bg-danger" />
    </View>
  );
}

function UntimedBand({ items, onOpen, onToggleTodo }: { items: CalendarItem[]; onOpen: (i: CalendarItem) => void; onToggleTodo: (id: string) => void }) {
  const C = useColors();
  return (
    <View className="px-4 pb-2 border-b border-ink-75">
      <Text className="text-[10px] font-bold tracking-widest text-ink-300 mb-1.5">ALL DAY · TASKS</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {items.map((it) =>
          it.type === "todo" ? (
            <TouchableOpacity
              key={it.id}
              onPress={() => onOpen(it)}
              activeOpacity={0.7}
              className="flex-row items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full bg-ink-50 border border-ink-100"
            >
              <TouchableOpacity
                onPress={() => it.todoId && onToggleTodo(it.todoId)}
                hitSlop={8}
                className={`w-[18px] h-[18px] rounded-full border-[1.5px] items-center justify-center ${it.completed ? "bg-accent border-accent" : "border-ink-300"}`}
              >
                {it.completed && <Feather name="check" size={11} color={C.onAccent} />}
              </TouchableOpacity>
              <Text className={`text-xs font-medium ${it.completed ? "text-ink-300 line-through" : "text-black"}`} numberOfLines={1}>
                {it.title}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              key={it.id}
              onPress={() => onOpen(it)}
              activeOpacity={0.7}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent"
            >
              <Feather name="sun" size={11} color={C.onAccent} />
              <Text className="text-xs font-semibold text-accent-on" numberOfLines={1}>{it.title}</Text>
            </TouchableOpacity>
          ),
        )}
      </View>
    </View>
  );
}

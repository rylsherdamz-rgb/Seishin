import { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn } from "react-native-reanimated";
import { weekOf, WEEKDAY_SHORT } from "./calendar-utils";
import type { DayMarks } from "./MonthGrid";
import { keyToDate } from "@/utils/recurrence";

interface WeekStripProps {
  selected: string;
  today: string;
  marks: Record<string, DayMarks>;
  onSelect: (key: string) => void;
  onLongPress: (key: string) => void;
  onSwipe: (delta: 1 | -1) => void;
}

/** Compact one-week scroller shown when the month grid is collapsed. */
export function WeekStrip({ selected, today, marks, onSelect, onLongPress, onSwipe }: WeekStripProps) {
  const days = useMemo(() => weekOf(selected), [selected]);
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((e) => {
          if (Math.abs(e.translationX) > 50) onSwipe(e.translationX < 0 ? 1 : -1);
        }),
    [onSwipe],
  );

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View key={days[0]} entering={FadeIn.duration(180)} className="flex-row px-2 gap-1">
        {days.map((key) => {
          const isSel = key === selected;
          const isToday = key === today;
          const m = marks[key];
          const load = (m?.events ?? 0) + (m?.todos ?? 0);
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onSelect(key)}
              onLongPress={() => onLongPress(key)}
              delayLongPress={350}
              activeOpacity={0.7}
              className={`flex-1 items-center py-2 rounded-2xl ${isSel ? "bg-accent" : isToday ? "bg-ink-50" : ""}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}
            >
              <Text className={`text-[11px] font-semibold ${isSel ? "text-accent-on opacity-80" : "text-ink-300"}`}>
                {WEEKDAY_SHORT[keyToDate(key).getDay()]}
              </Text>
              <Text
                className={`text-[17px] font-bold mt-0.5 ${isSel ? "text-accent-on" : isToday ? "text-accent" : "text-black"}`}
              >
                {Number(key.slice(8))}
              </Text>
              <View className="flex-row gap-[3px] mt-1 h-1">
                {Array.from({ length: Math.min(load, 3) }, (_, i) => (
                  <View key={i} className={`w-1 h-1 rounded-full ${isSel ? "bg-accent-on" : "bg-accent"}`} />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </GestureDetector>
  );
}

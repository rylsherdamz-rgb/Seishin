import { memo, useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn } from "react-native-reanimated";
import { monthMatrix, sameMonth, WEEKDAY_LETTER } from "./calendar-utils";

export interface DayMarks {
  events: number;
  todos: number;
}

interface MonthGridProps {
  month: string;
  selected: string;
  today: string;
  marks: Record<string, DayMarks>;
  onSelect: (key: string) => void;
  onLongPress: (key: string) => void;
  onSwipe: (delta: 1 | -1) => void;
}

/** Swipeable month grid: tap selects, long-press quick-creates, swipe changes month. */
export function MonthGrid({ month, selected, today, marks, onSelect, onLongPress, onSwipe }: MonthGridProps) {
  const rows = useMemo(() => monthMatrix(month), [month]);
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
      <Animated.View key={month} entering={FadeIn.duration(180)} className="px-2">
        <View className="flex-row mb-1">
          {WEEKDAY_LETTER.map((l, i) => (
            <Text key={i} className="flex-1 text-center text-[11px] font-semibold text-ink-300">
              {l}
            </Text>
          ))}
        </View>
        {rows.map((week) => (
          <View key={week[0]} className="flex-row">
            {week.map((key) => (
              <DayCell
                key={key}
                dateKey={key}
                inMonth={sameMonth(key, month)}
                isToday={key === today}
                isSelected={key === selected}
                marks={marks[key]}
                onSelect={onSelect}
                onLongPress={onLongPress}
              />
            ))}
          </View>
        ))}
      </Animated.View>
    </GestureDetector>
  );
}

interface DayCellProps {
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  marks?: DayMarks;
  onSelect: (key: string) => void;
  onLongPress: (key: string) => void;
}

const DayCell = memo(function DayCell({ dateKey, inMonth, isToday, isSelected, marks, onSelect, onLongPress }: DayCellProps) {
  const day = Number(dateKey.slice(8));
  const circle = isSelected ? "bg-accent" : isToday ? "border-[1.5px] border-accent" : "";
  const text = isSelected
    ? "text-accent-on font-bold"
    : isToday
      ? "text-accent font-bold"
      : inMonth
        ? "text-black"
        : "text-ink-200";
  const dots = Math.min((marks?.events ?? 0) + (marks?.todos ?? 0), 3);

  return (
    <TouchableOpacity
      onPress={() => onSelect(dateKey)}
      onLongPress={() => onLongPress(dateKey)}
      delayLongPress={350}
      activeOpacity={0.6}
      className="flex-1 items-center py-1"
      style={{ height: 46 }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View className={`w-8 h-8 rounded-full items-center justify-center ${circle}`}>
        <Text className={`text-[13px] ${text}`}>{day}</Text>
      </View>
      <View className="flex-row gap-[3px] mt-[3px] h-1">
        {Array.from({ length: dots }, (_, i) => {
          const isEvent = i < (marks?.events ?? 0);
          return (
            <View
              key={i}
              className={`w-1 h-1 rounded-full ${isEvent ? "bg-accent" : "bg-ink-300"} ${inMonth ? "" : "opacity-40"}`}
            />
          );
        })}
      </View>
    </TouchableOpacity>
  );
});

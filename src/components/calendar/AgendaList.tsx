import { memo, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { COPY } from "@/constants/copy";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDuration, minutesOf, type AgendaRow, type CalendarItem } from "./calendar-utils";

const SOURCE_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  manual: "edit-2", ocr: "camera", email: "mail",
  notification: "bell", chat: "message-circle", ai: "cpu", calendar: "refresh-cw",
};

interface AgendaListProps {
  rows: AgendaRow[];
  today: string;
  emptyTitle: string;
  emptySubtitle: string;
  onOpen: (item: CalendarItem) => void;
  onToggleTodo: (todoId: string) => void;
  onShowDay: (date: string) => void;
}

export function AgendaList({ rows, today, emptyTitle, emptySubtitle, onOpen, onToggleTodo, onShowDay }: AgendaListProps) {
  const renderItem = useCallback(
    ({ item, index }: { item: AgendaRow; index: number }) => {
      const content = "kind" in item ? (
        <TouchableOpacity onPress={() => onShowDay(item.date)} activeOpacity={0.7} accessibilityRole="header" className="flex-row items-center gap-2 pt-5 pb-2">
          <Text className={`text-xs font-bold tracking-wider uppercase ${item.date === today ? "text-accent" : "text-ink-400"}`}>
            {item.label}
          </Text>
          <View className="flex-1 h-px bg-ink-75" />
        </TouchableOpacity>
      ) : (
        <AgendaCard item={item} past={item.date < today} onOpen={onOpen} onToggleTodo={onToggleTodo} />
      );
      // Animate only the first screenful; rows virtualized in while scrolling
      // render immediately rather than replaying an entrance animation.
      if (index >= 8) return content;
      return <Animated.View entering={FadeInDown.delay(index * 30).duration(240)}>{content}</Animated.View>;
    },
    [today, onOpen, onToggleTodo, onShowDay],
  );

  return (
    <FlatList
      data={rows}
      className="flex-1"
      keyExtractor={(r) => ("kind" in r ? `h-${r.date}` : r.id)}
      contentContainerClassName="px-4 pb-32"
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      maxToRenderPerBatch={12}
      windowSize={10}
      renderItem={renderItem}
      ListEmptyComponent={<EmptyState icon="sun" title={emptyTitle} subtitle={emptySubtitle} />}
    />
  );
}

interface CardProps {
  item: CalendarItem;
  past: boolean;
  onOpen: (item: CalendarItem) => void;
  onToggleTodo: (todoId: string) => void;
}

const AgendaCard = memo(function AgendaCard({ item, past, onOpen, onToggleTodo }: CardProps) {
  const C = useColors();
  if (item.type === "todo") {
    return (
      <TouchableOpacity
        onPress={() => onOpen(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${COPY.terms.task}: ${item.title}`}
        className={`flex-row items-center gap-3 px-3.5 py-3 mb-2 rounded-2xl bg-ink-25 border border-ink-75 ${past && !item.completed ? "opacity-60" : ""}`}
      >
        <TouchableOpacity
          onPress={() => item.todoId && onToggleTodo(item.todoId)}
          hitSlop={10}
          className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${item.completed ? "bg-accent border-accent" : "border-ink-300"}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!item.completed }}
        >
          {item.completed && <Feather name="check" size={13} color={C.onAccent} />}
        </TouchableOpacity>
        <View className="flex-1">
          <Text className={`text-[15px] ${item.completed ? "line-through text-ink-300" : "text-black font-medium"}`} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
        {item.priority === "high" && !item.completed ? (
          <View className="px-2 py-0.5 rounded-full bg-danger-soft">
            <Text className="text-[10px] font-bold text-danger">{COPY.calendar.priorityHigh}</Text>
          </View>
        ) : (
          <Text className="text-[11px] text-ink-300 capitalize">{item.priority}</Text>
        )}
      </TouchableOpacity>
    );
  }

  const start = minutesOf(item.startDate);
  const end = minutesOf(item.endDate);
  const dur = start !== null && end !== null && end > start ? end - start : null;
  return (
    <TouchableOpacity
      onPress={() => onOpen(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${COPY.terms.event}: ${item.title}, ${item.allDay ? COPY.calendar.allDay : `${item.time ?? ""}${item.endTime ? ` to ${item.endTime}` : ""}`}`}
      className={`flex-row gap-3 mb-2 ${past ? "opacity-55" : ""}`}
    >
      <View className="w-14 pt-3 items-end">
        <Text className="text-[13px] font-semibold text-black">{item.allDay ? COPY.calendar.allDay : item.time}</Text>
        {!item.allDay && dur ? <Text className="text-[11px] text-ink-300 mt-0.5">{formatDuration(dur)}</Text> : null}
      </View>
      <View className="flex-1 flex-row rounded-2xl bg-accent/10 overflow-hidden">
        <View className="w-1 bg-accent" />
        <View className="flex-1 px-3 py-2.5">
          <Text className="text-[15px] font-semibold text-black" numberOfLines={2}>{item.title}</Text>
          {item.notes || item.description ? (
            <Text className="text-xs text-ink-500 mt-0.5" numberOfLines={1}>{item.notes || item.description}</Text>
          ) : null}
          <View className="flex-row items-center gap-2.5 mt-1.5">
            {!item.allDay && item.endTime ? (
              <Text className="text-[11px] text-ink-400">{item.time} – {item.endTime}</Text>
            ) : null}
            <Feather name={SOURCE_ICONS[item.source ?? ""] ?? "calendar"} size={11} color={C.ink300} />
            {item.recurrence ? <Feather name="repeat" size={11} color={C.ink300} /> : null}
            {item.reminder ? <Feather name="bell" size={11} color={C.ink300} /> : null}
            {item.attachments?.length ? <Feather name="paperclip" size={11} color={C.ink300} /> : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { keyToDate } from "@/utils/recurrence";
import { formatDuration, greeting } from "./calendar-utils";

export type CalendarView = "day" | "list" | "upcoming";

const VIEWS: { key: CalendarView; label: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { key: "day", label: "Timeline", icon: "clock" },
  { key: "list", label: "Agenda", icon: "list" },
  { key: "upcoming", label: "Upcoming", icon: "fast-forward" },
];

interface HeaderProps {
  month: string;
  expanded: boolean;
  showToday: boolean;
  onToggleExpanded: () => void;
  onToday: () => void;
  onShiftMonth: (delta: 1 | -1) => void;
}

export function CalendarHeader({ month, expanded, showToday, onToggleExpanded, onToday, onShiftMonth }: HeaderProps) {
  const C = useColors();
  const d = keyToDate(month);
  return (
    <View className="px-4 pt-2 pb-3">
      <Text className="text-xs font-semibold text-ink-400">{greeting()}</Text>
      <View className="flex-row items-center justify-between mt-0.5">
        <TouchableOpacity onPress={onToggleExpanded} activeOpacity={0.7} className="flex-row items-center gap-1.5" accessibilityLabel="Toggle month view">
          <Text className="text-[26px] font-bold tracking-tightest text-black">
            {d.toLocaleDateString(undefined, { month: "long" })}
          </Text>
          <Text className="text-[26px] font-light tracking-tightest text-ink-300">{d.getFullYear()}</Text>
          <View className={`w-6 h-6 rounded-full items-center justify-center ml-0.5 ${expanded ? "bg-black" : "bg-ink-75"}`}>
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={expanded ? C.white : C.ink500} />
          </View>
        </TouchableOpacity>
        <View className="flex-row items-center gap-1.5">
          {showToday && (
            <TouchableOpacity onPress={onToday} activeOpacity={0.7} className="px-3 h-8 rounded-full border border-accent items-center justify-center">
              <Text className="text-xs font-bold text-accent">Today</Text>
            </TouchableOpacity>
          )}
          {expanded && (
            <>
              <RoundButton icon="chevron-left" onPress={() => onShiftMonth(-1)} />
              <RoundButton icon="chevron-right" onPress={() => onShiftMonth(1)} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function RoundButton({ icon, onPress }: { icon: "chevron-left" | "chevron-right"; onPress: () => void }) {
  const C = useColors();
  return (
    <TouchableOpacity onPress={onPress} hitSlop={6} activeOpacity={0.7} className="w-8 h-8 rounded-full bg-ink-50 items-center justify-center">
      <Feather name={icon} size={16} color={C.black} />
    </TouchableOpacity>
  );
}

export function ViewSwitcher({ value, onChange }: { value: CalendarView; onChange: (v: CalendarView) => void }) {
  const C = useColors();
  return (
    <View className="flex-row bg-ink-50 rounded-2xl p-1 mx-4">
      {VIEWS.map((v) => {
        const active = v.key === value;
        return (
          <TouchableOpacity
            key={v.key}
            onPress={() => onChange(v.key)}
            activeOpacity={0.8}
            className={`flex-1 flex-row items-center justify-center gap-1.5 h-9 rounded-xl ${active ? "bg-white shadow-subtle" : ""}`}
          >
            <Feather name={v.icon} size={13} color={active ? C.accent : C.ink300} />
            <Text className={`text-xs font-bold ${active ? "text-black" : "text-ink-400"}`}>{v.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function DaySummary({ label, events, tasks, done, booked }: {
  label: string;
  events: number;
  tasks: number;
  done: number;
  booked: number;
}) {
  const parts = [
    events ? `${events} event${events > 1 ? "s" : ""}` : null,
    tasks ? `${done}/${tasks} task${tasks > 1 ? "s" : ""} done` : null,
    booked ? `${formatDuration(booked)} booked` : null,
  ].filter(Boolean);
  return (
    <View className="flex-row items-baseline justify-between px-4 pt-4 pb-2">
      <Text className="text-[15px] font-bold text-black">{label}</Text>
      <Text className="text-xs text-ink-400">{parts.length ? parts.join(" · ") : "Free day"}</Text>
    </View>
  );
}

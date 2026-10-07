import { useMemo, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from "react-native";
import BottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { formatClock, atMinutes, formatDuration, nextSlotMinutes, parseQuickAdd, relativeDayLabel, type QuickParse } from "./calendar-utils";

type IconName = React.ComponentProps<typeof Feather>["name"];
export type CreateKind = "event" | "todo";

export const TEMPLATES: { title: string; icon: IconName; minutes: number }[] = [
  { title: "Focus time", icon: "target", minutes: 60 },
  { title: "Meeting", icon: "users", minutes: 30 },
  { title: "Workout", icon: "activity", minutes: 60 },
  { title: "Lunch", icon: "coffee", minutes: 60 },
  { title: "Study", icon: "book-open", minutes: 90 },
  { title: "Break", icon: "pause-circle", minutes: 15 },
];

interface CreateSheetProps {
  date: string;
  onClose: () => void;
  onQuickAdd: (kind: CreateKind, parsed: QuickParse) => void;
  onNewEvent: () => void;
  onTemplate: (title: string, minutes: number) => void;
  onNewTodo: () => void;
  onNewNote: () => void;
  onScan: () => void;
}

/** The "+" menu: natural-language quick add, shortcuts and templates. */
export function CreateSheet({ date, onClose, onQuickAdd, onNewEvent, onTemplate, onNewTodo, onNewNote, onScan }: CreateSheetProps) {
  const C = useColors();
  const sheetRef = useRef<BottomSheet>(null);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<CreateKind>("event");
  const keyboardPad = useKeyboardPadding();
  const parsed = useMemo(() => parseQuickAdd(text, date), [text, date]);

  const done = (fn: () => void) => {
    sheetRef.current?.close();
    onClose();
    // Let this sheet finish dismissing before presenting the next screen/sheet.
    setTimeout(fn, 250);
  };
  const submitQuick = () => {
    if (!parsed.title) return;
    done(() => onQuickAdd(kind, parsed));
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: C.white }}
      onChange={(i: number) => { if (i === -1) onClose(); }}
    >
      <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 + (Platform.OS === "android" ? keyboardPad : 0) }}>
        <Text className="text-xl font-bold tracking-tightest text-black">Create</Text>
        <Text className="text-xs text-ink-400 mt-0.5 mb-4">for {relativeDayLabel(date)} · type naturally, e.g. “Gym tomorrow 6pm for 1h”</Text>

        <View className="flex-row items-center gap-2 pl-4 pr-1.5 h-14 rounded-2xl bg-ink-50 border border-ink-100">
          <Feather name="zap" size={16} color={C.accent} />
          <TextInput
            className="flex-1 text-[15px] text-black"
            placeholder={kind === "event" ? "Add an event…" : "Add a task…"}
            placeholderTextColor={C.ink300}
            value={text}
            onChangeText={setText}
            onSubmitEditing={submitQuick}
            returnKeyType="done"
          />
          <TouchableOpacity
            onPress={submitQuick}
            disabled={!parsed.title}
            className={`w-11 h-11 rounded-xl items-center justify-center ${parsed.title ? "bg-accent" : "bg-ink-100"}`}
            accessibilityLabel="Quick add"
          >
            <Feather name="arrow-up" size={18} color={parsed.title ? C.onAccent : C.ink300} />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center gap-2 mt-2.5">
          {(["event", "todo"] as const).map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => setKind(k)}
              className={`flex-row items-center gap-1.5 px-3 h-8 rounded-full ${kind === k ? "bg-black" : "bg-ink-50"}`}
            >
              <Feather name={k === "event" ? "calendar" : "check-circle"} size={12} color={kind === k ? C.white : C.ink500} />
              <Text className={`text-xs font-semibold ${kind === k ? "text-white" : "text-ink-500"}`}>{k === "event" ? "Event" : "Task"}</Text>
            </TouchableOpacity>
          ))}
          {parsed.title ? <ParsePreview kind={kind} parsed={parsed} /> : null}
        </View>

        <View className="flex-row gap-2.5 mt-5">
          <Tile icon="calendar" label="Event" hint="Full details" primary onPress={() => done(onNewEvent)} />
          <Tile icon="check-square" label="Task" hint="To-do list" onPress={() => done(onNewTodo)} />
        </View>
        <View className="flex-row gap-2.5 mt-2.5">
          <Tile icon="file-text" label="Note" hint="Ideas & files" onPress={() => done(onNewNote)} />
          <Tile icon="maximize" label="Scan" hint="Photo → event" onPress={() => done(onScan)} />
        </View>

        <Text className="text-[11px] font-bold tracking-widest text-ink-300 mt-6 mb-2">QUICK BLOCKS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TEMPLATES.map((t) => (
            <TouchableOpacity
              key={t.title}
              onPress={() => done(() => onTemplate(t.title, t.minutes))}
              activeOpacity={0.7}
              className="flex-row items-center gap-2 pl-3 pr-3.5 h-10 rounded-full border border-ink-150 bg-white"
            >
              <Feather name={t.icon} size={14} color={C.accent} />
              <Text className="text-[13px] font-semibold text-black">{t.title}</Text>
              <Text className="text-[11px] text-ink-300">{formatDuration(t.minutes)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheetView>
    </BottomSheet>
  );
}

function ParsePreview({ kind, parsed }: { kind: CreateKind; parsed: QuickParse }) {
  const start = parsed.minutes ?? nextSlotMinutes();
  const time = kind === "event" ? ` · ${formatClock(atMinutes(parsed.date, start))}` : "";
  const dur = kind === "event" && parsed.duration ? ` · ${formatDuration(parsed.duration)}` : "";
  return (
    <Text className="flex-1 text-right text-[11px] text-ink-400" numberOfLines={1}>
      {relativeDayLabel(parsed.date)}{time}{dur}
    </Text>
  );
}

function Tile({ icon, label, hint, onPress, primary }: { icon: IconName; label: string; hint: string; onPress: () => void; primary?: boolean }) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`flex-1 flex-row items-center gap-3 p-3.5 rounded-2xl ${primary ? "bg-accent" : "bg-ink-50 border border-ink-75"}`}
    >
      <View className={`w-10 h-10 rounded-xl items-center justify-center ${primary ? "bg-accent-on/20" : "bg-white"}`}>
        <Feather name={icon} size={18} color={primary ? C.onAccent : C.black} />
      </View>
      <View className="flex-1">
        <Text className={`text-[15px] font-bold ${primary ? "text-accent-on" : "text-black"}`}>{label}</Text>
        <Text className={`text-[11px] ${primary ? "text-accent-on opacity-75" : "text-ink-400"}`}>{hint}</Text>
      </View>
    </TouchableOpacity>
  );
}

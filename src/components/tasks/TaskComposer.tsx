import { memo, useCallback, useEffect, useRef, useState } from "react";
import { View, TextInput, TouchableOpacity, ScrollView } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Feather from "@expo/vector-icons/Feather";
import { Chip } from "@/components/ui/Chip";
import { useColors } from "@/theme/ThemeProvider";
import { dayLabel } from "@/widgets/widget-data";
import { dateKey } from "@/utils/recurrence";
import { quickDue, quickDueOf, type QuickDue } from "@/utils/task-groups";
import { loadTodoDraft, saveTodoDraft, clearTodoDraft } from "@/utils/drafts";

const CHIPS: { kind: QuickDue; label: string }[] = [
  { kind: "today", label: "Today" },
  { kind: "tomorrow", label: "Tomorrow" },
  { kind: "nextweek", label: "Next week" },
];
const DRAFT_DELAY = 400;

/**
 * Quick add for the Tasks screen. Owns its own text state, so typing never
 * re-renders the task list; the draft is saved after a pause, not per key.
 * Date chips appear once the box is in use.
 */
export const TaskComposer = memo(function TaskComposer({
  onAdd,
  autoFocus,
}: {
  onAdd: (title: string, due: Date | null) => void;
  autoFocus?: boolean;
}) {
  const C = useColors();
  const input = useRef<TextInput>(null);
  const [title, setTitle] = useState(() => loadTodoDraft().title ?? "");
  const [due, setDue] = useState<Date | null>(() => {
    const iso = loadTodoDraft().dueDate;
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  });
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => input.current?.focus(), 300);
    return () => clearTimeout(t);
  }, [autoFocus]);

  // Debounced draft autosave; the latest value is flushed on unmount.
  const latest = useRef({ title, due });
  latest.current = { title, due };
  useEffect(() => {
    const t = setTimeout(() => saveTodoDraft({ title, dueDate: due?.toISOString() }), DRAFT_DELAY);
    return () => clearTimeout(t);
  }, [title, due]);
  useEffect(() => () => {
    const { title: t, due: d } = latest.current;
    saveTodoDraft({ title: t, dueDate: d?.toISOString() });
  }, []);

  const canAdd = title.trim().length > 0;
  const submit = useCallback(() => {
    const t = title.trim();
    if (!t) return;
    onAdd(t, due);
    setTitle("");
    setDue(null);
    clearTodoDraft();
  }, [title, due, onAdd]);

  const now = new Date();
  const active = quickDueOf(due, now);
  const custom = due && !active ? dayLabel(dateKey(due), dateKey(now)) : null;
  const expanded = focused || canAdd || !!due;

  return (
    <View className="mx-4 mb-2 rounded-2xl border border-ink-100 bg-white">
      <View className="flex-row items-center pl-4 pr-1.5 min-h-[52px]">
        <TextInput
          ref={input}
          className="flex-1 text-[15px] text-black py-3"
          placeholder="Add a task"
          placeholderTextColor={C.ink400}
          value={title}
          onChangeText={setTitle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={submit}
          submitBehavior="submit"
          returnKeyType="done"
          maxLength={200}
          accessibilityLabel="New task title"
        />
        <TouchableOpacity
          onPress={submit}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel="Add task"
          accessibilityState={{ disabled: !canAdd }}
          className={`w-10 h-10 rounded-full items-center justify-center ${canAdd ? "bg-accent" : "bg-ink-50"}`}
        >
          <Feather name="arrow-up" size={18} color={canAdd ? C.onAccent : C.ink400} />
        </TouchableOpacity>
      </View>

      {expanded ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}
        >
          {CHIPS.map((c) => (
            <Chip
              key={c.kind}
              label={c.label}
              active={active === c.kind}
              onPress={() => setDue(active === c.kind ? null : quickDue(c.kind, new Date()))}
            />
          ))}
          <Chip
            label={custom ?? "Pick date"}
            icon={custom ? "x" : "calendar"}
            active={!!custom}
            onPress={() => (custom ? setDue(null) : setPicking(true))}
          />
        </ScrollView>
      ) : null}

      {picking ? (
        <DateTimePicker
          value={due ?? new Date()}
          mode="date"
          minimumDate={new Date()}
          onChange={(_, d) => {
            setPicking(false);
            if (d) setDue(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59));
          }}
        />
      ) : null}
    </View>
  );
});

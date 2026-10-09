import { memo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { KIND_LABELS, type CaptureKind } from "@/services/capture-analyzer";
import type { ReminderLevel } from "@/services/reminder-plan";

export interface ReviewState {
  kind: CaptureKind;
  title: string;
  subject: string;
  due: Date | null;
  dueHasTime: boolean;
  items: string[];
  reminder: ReminderLevel;
}

interface Props {
  value: ReviewState;
  onChange: (patch: Partial<ReviewState>) => void;
  unsure: boolean;
  onPickDate: () => void;
  onPickTime: () => void;
}

const KIND_ICONS: Record<CaptureKind, React.ComponentProps<typeof Feather>["name"]> = {
  assignment: "edit-3", exam: "award", event: "calendar", reading: "book-open", other: "help-circle",
};

const REMINDERS: { value: ReminderLevel; label: string; hint: string }[] = [
  { value: "persistent", label: "Keep reminding me", hint: "Twice a day, a countdown, and daily if overdue — until it's done" },
  { value: "normal", label: "Before the deadline", hint: "1 day, 6 h, 2 h and 30 min before" },
  { value: "off", label: "No reminders", hint: "Just save it" },
];

/** Editable reading of a capture: what it is, when it's due, what to answer. */
export const CaptureReview = memo(function CaptureReview({ value: v, onChange, unsure, onPickDate, onPickTime }: Props) {
  const C = useColors();
  const [newItem, setNewItem] = useState("");
  const addItem = () => {
    const t = newItem.trim();
    if (t) onChange({ items: [...v.items, t.slice(0, 220)] });
    setNewItem("");
  };

  return (
    <View className="gap-5">
      <Section title={unsure ? "I'm not sure what this is — what is it?" : "This looks like"} highlight={unsure}>
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(KIND_LABELS) as CaptureKind[]).map((k) => {
            const on = v.kind === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => onChange({ kind: k })}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                className={`flex-row items-center gap-1.5 h-10 px-3.5 rounded-lg border ${on ? "bg-accent/15 border-transparent" : "border-ink-150"}`}
              >
                <Feather name={on ? "check" : KIND_ICONS[k]} size={14} color={on ? C.black : C.ink600} />
                <Text className={`text-[13px] font-semibold ${on ? "text-black" : "text-ink-700"}`}>{KIND_LABELS[k]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      <Section title="Title">
        <TextInput
          value={v.title}
          onChangeText={(title) => onChange({ title })}
          placeholder="What is it called?"
          placeholderTextColor={C.ink400}
          maxLength={120}
          className="h-12 rounded-xl bg-ink-50 px-4 text-[15px] font-semibold text-black"
          accessibilityLabel="Title"
        />
        <TextInput
          value={v.subject}
          onChangeText={(subject) => onChange({ subject })}
          placeholder="Subject or course (optional)"
          placeholderTextColor={C.ink400}
          maxLength={40}
          className="h-11 rounded-xl bg-ink-50 px-4 mt-2 text-sm text-black"
          accessibilityLabel="Subject"
        />
      </Section>

      <Section title={v.kind === "event" ? "When" : "Due"} highlight={!v.due && v.kind !== "reading" && v.kind !== "other"}>
        {v.due ? (
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={onPickDate} accessibilityRole="button" className="flex-1 h-12 rounded-xl bg-ink-50 px-4 flex-row items-center gap-2">
              <Feather name="calendar" size={15} color={C.ink600} />
              <Text className="text-[15px] font-semibold text-black">
                {v.due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onPickTime} accessibilityRole="button" className="h-12 rounded-xl bg-ink-50 px-4 flex-row items-center gap-2">
              <Feather name="clock" size={15} color={C.ink600} />
              <Text className="text-[15px] font-semibold text-black">
                {v.dueHasTime ? v.due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "End of day"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange({ due: null })} accessibilityRole="button" accessibilityLabel="Remove due date" className="w-12 h-12 items-center justify-center">
              <Feather name="x" size={18} color={C.ink500} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={onPickDate} accessibilityRole="button" className="h-12 rounded-xl border border-dashed border-ink-300 px-4 flex-row items-center gap-2">
            <Feather name="alert-circle" size={15} color={C.ink600} />
            <Text className="text-sm font-semibold text-ink-700">No date found — tap to set one</Text>
          </TouchableOpacity>
        )}
      </Section>

      {v.kind !== "event" ? (
        <Section title={v.items.length ? `To answer · ${v.items.length}` : "To answer"}>
          {v.items.map((item, i) => (
            <View key={`${i}-${item}`} className="flex-row items-start gap-3 py-2 border-b border-ink-75">
              <Text className="w-6 text-sm font-bold text-ink-500 pt-0.5">{i + 1}.</Text>
              <Text className="flex-1 text-[15px] leading-[21px] text-black">{item}</Text>
              <TouchableOpacity
                onPress={() => onChange({ items: v.items.filter((_, j) => j !== i) })}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove item ${i + 1}`}
                className="w-8 h-8 items-center justify-center"
              >
                <Feather name="x" size={16} color={C.ink500} />
              </TouchableOpacity>
            </View>
          ))}
          <View className="flex-row items-center gap-2 mt-2 h-11 rounded-xl bg-ink-50 px-3">
            <Feather name="plus" size={16} color={C.ink600} />
            <TextInput
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={addItem}
              blurOnSubmit={false}
              returnKeyType="done"
              placeholder={v.items.length ? "Add another item" : "Add a question or part to do"}
              placeholderTextColor={C.ink400}
              className="flex-1 text-sm text-black"
              accessibilityLabel="Add item"
            />
          </View>
        </Section>
      ) : null}

      <Section title="Reminders">
        {REMINDERS.map((r) => {
          const on = v.reminder === r.value;
          return (
            <TouchableOpacity
              key={r.value}
              onPress={() => onChange({ reminder: r.value })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              className={`flex-row items-center gap-3 p-3.5 rounded-xl mb-2 border ${on ? "border-accent bg-accent/10" : "border-ink-100"}`}
            >
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${on ? "border-accent" : "border-ink-300"}`}>
                {on ? <View className="w-2.5 h-2.5 rounded-full bg-accent" /> : null}
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-semibold text-black">{r.label}</Text>
                <Text className="text-xs text-ink-500 mt-0.5">{r.hint}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </Section>
    </View>
  );
});

function Section({ title, highlight, children }: { title: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <View>
      <Text className={`text-xs font-bold tracking-wide mb-2 ${highlight ? "text-accent" : "text-ink-500"}`}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

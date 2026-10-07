import { View, Text, TouchableOpacity, TextInput, Image, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import type { NoteAttachment } from "@/stores/notes-store";
import { WEEKDAY_LETTER } from "./calendar-utils";

type IconName = React.ComponentProps<typeof Feather>["name"];

export function FieldLabel({ children }: { children: string }) {
  return <Text className="text-[11px] font-bold tracking-widest text-ink-300 mb-2 mt-5">{children}</Text>;
}

/** Tappable value tile used for date / time fields. */
export function FieldCard({ icon, label, value, onPress, className = "" }: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  className?: string;
}) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-center gap-3 px-4 h-14 rounded-2xl bg-ink-50 border border-ink-75 ${className}`}
    >
      <Feather name={icon} size={16} color={C.ink500} />
      <View className="flex-1">
        <Text className="text-[10px] font-semibold text-ink-400">{label}</Text>
        <Text className="text-[15px] font-semibold text-black">{value}</Text>
      </View>
    </TouchableOpacity>
  );
}

/** Horizontal pill choices (repeat, reminder, duration…). */
export function PillRow<V extends string | number>({ options, value, onChange }: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            activeOpacity={0.7}
            className={`px-3.5 h-9 rounded-full items-center justify-center border ${active ? "bg-accent border-accent" : "bg-white border-ink-150"}`}
          >
            <Text className={`text-xs font-semibold ${active ? "text-accent-on" : "text-ink-600"}`}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function WeekdayPicker({ value, onToggle }: { value: number[]; onToggle: (d: number) => void }) {
  return (
    <View className="flex-row justify-between mt-3">
      {WEEKDAY_LETTER.map((label, d) => {
        const on = value.includes(d);
        return (
          <TouchableOpacity
            key={d}
            onPress={() => onToggle(d)}
            activeOpacity={0.7}
            className={`w-10 h-10 rounded-full items-center justify-center ${on ? "bg-accent" : "bg-ink-50 border border-ink-100"}`}
          >
            <Text className={`text-xs font-bold ${on ? "text-accent-on" : "text-ink-500"}`}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SwitchRow({ icon, label, value, onChange }: {
  icon: IconName;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
      className="flex-row items-center gap-3 px-4 h-14 rounded-2xl bg-ink-50 border border-ink-75 mt-3"
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Feather name={icon} size={16} color={C.ink500} />
      <Text className="flex-1 text-[15px] font-semibold text-black">{label}</Text>
      <View className={`w-11 h-6 rounded-full p-0.5 ${value ? "bg-accent items-end" : "bg-ink-150 items-start"}`}>
        <View className={`w-5 h-5 rounded-full ${value ? "bg-accent-on" : "bg-white"}`} />
      </View>
    </TouchableOpacity>
  );
}

export function NotesBox({ notes, onChangeNotes, attachments, onRemove, onCamera, onGallery, onScan, ocrBusy }: {
  notes: string;
  onChangeNotes: (t: string) => void;
  attachments: NoteAttachment[];
  onRemove: (id: string) => void;
  onCamera: () => void;
  onGallery: () => void;
  onScan: () => void;
  ocrBusy: boolean;
}) {
  const C = useColors();
  return (
    <View className="bg-ink-50 border border-ink-75 rounded-2xl px-4 pt-3">
      <TextInput
        className="min-h-[72px] max-h-[180px] text-sm leading-5 text-black"
        placeholder="Add notes, links, agenda…"
        placeholderTextColor={C.ink300}
        value={notes}
        onChangeText={onChangeNotes}
        multiline
        textAlignVertical="top"
        style={{ paddingVertical: 0 }}
      />
      {ocrBusy && (
        <View className="flex-row items-center gap-2 pt-2">
          <ActivityIndicator size="small" color={C.black} />
          <Text className="text-xs text-ink-500">Reading text from image…</Text>
        </View>
      )}
      {attachments.length > 0 && (
        <View className="flex-row flex-wrap gap-2 pt-3">
          {attachments.map((a) => (
            <View key={a.id}>
              <Image source={{ uri: a.uri }} className="w-20 h-20 rounded-xl bg-ink-100" resizeMode="cover" />
              <TouchableOpacity
                onPress={() => onRemove(a.id)}
                hitSlop={10}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-black rounded-full items-center justify-center border-2 border-white"
              >
                <Feather name="x" size={11} color={C.white} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View className="flex-row items-center border-t border-ink-100 mt-3 py-1 -mx-1">
        <ToolButton icon="camera" label="Camera" onPress={onCamera} />
        <ToolButton icon="image" label="Photo" onPress={onGallery} />
        <ToolButton icon="maximize" label="Scan text" onPress={onScan} />
      </View>
    </View>
  );
}

function ToolButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const C = useColors();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-row items-center gap-1.5 px-2.5 py-2.5">
      <Feather name={icon} size={15} color={C.ink500} />
      <Text className="text-xs font-semibold text-ink-600">{label}</Text>
    </TouchableOpacity>
  );
}

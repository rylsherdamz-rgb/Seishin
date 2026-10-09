import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import type { ReminderLevel } from "@/services/reminder-plan";

export function ago(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString();
}

export function StatusLine({ lastSync, lastError, busy, onSync }: { lastSync: string | null; lastError: string | null; busy: boolean; onSync: () => void }) {
  const C = useColors();
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className={`flex-1 text-[13px] font-medium ${lastError ? "text-danger" : "text-ink-600"}`} numberOfLines={2}>
        {lastError ?? `Synced ${ago(lastSync)}`}
      </Text>
      <TouchableOpacity onPress={onSync} disabled={busy} accessibilityRole="button" className="h-10 px-4 rounded-full bg-ink-50 flex-row items-center gap-2">
        {busy ? <ActivityIndicator size="small" color={C.black} /> : <Feather name="refresh-cw" size={14} color={C.black} />}
        <Text className="text-[13px] font-semibold text-black">Sync now</Text>
      </TouchableOpacity>
    </View>
  );
}

const LEVELS: { value: ReminderLevel; label: string }[] = [
  { value: "persistent", label: "Until done" },
  { value: "normal", label: "Before due" },
  { value: "off", label: "Off" },
];

export function ReminderChips({ value, onChange, label = "Remind me about imported deadlines" }: { value: ReminderLevel; onChange: (v: ReminderLevel) => void; label?: string }) {
  return (
    <View className="mt-4">
      <Text className="text-xs font-bold tracking-wide text-ink-500 mb-2">{label.toUpperCase()}</Text>
      <View className="flex-row bg-ink-50 rounded-2xl p-1">
        {LEVELS.map((l) => {
          const on = value === l.value;
          return (
            <TouchableOpacity
              key={l.value}
              onPress={() => onChange(l.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              className={`flex-1 h-10 rounded-xl items-center justify-center ${on ? "bg-white shadow-subtle" : ""}`}
            >
              <Text className={`text-[13px] font-semibold ${on ? "text-black" : "text-ink-500"}`}>{l.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function Field({ label, value, onChange, placeholder, secret }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; secret?: boolean }) {
  const C = useColors();
  return (
    <View className="mt-3">
      <Text className="text-xs font-semibold text-ink-600 mb-1.5">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.ink400}
        secureTextEntry={secret}
        autoCapitalize="none"
        autoCorrect={false}
        className="h-12 rounded-xl bg-ink-50 px-4 text-sm text-black"
        accessibilityLabel={label}
      />
    </View>
  );
}

export function Steps({ steps }: { steps: string[] }) {
  return (
    <View className="gap-1.5">
      {steps.map((s, i) => (
        <View key={i} className="flex-row gap-2">
          <Text className="w-4 text-[13px] font-bold text-ink-500">{i + 1}.</Text>
          <Text className="flex-1 text-[13px] text-ink-700 leading-[19px]">{s}</Text>
        </View>
      ))}
    </View>
  );
}

export function PrimaryButton({ label, onPress, busy, disabled, icon = "link" }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; icon?: React.ComponentProps<typeof Feather>["name"] }) {
  const C = useColors();
  const off = disabled || busy;
  return (
    <TouchableOpacity onPress={onPress} disabled={off} accessibilityRole="button" className={`mt-4 h-12 rounded-xl flex-row items-center justify-center gap-2 ${off ? "bg-ink-100" : "bg-accent"}`}>
      {busy ? <ActivityIndicator color={C.onAccent} /> : <Feather name={icon} size={16} color={off ? C.ink400 : C.onAccent} />}
      <Text className={`text-[15px] font-bold ${off ? "text-ink-400" : "text-accent-on"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export function DangerLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" className="mt-3 h-11 justify-center self-start">
      <Text className="text-sm font-semibold text-danger">{label}</Text>
    </TouchableOpacity>
  );
}

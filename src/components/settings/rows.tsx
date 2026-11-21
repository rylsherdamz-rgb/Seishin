import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Card } from "@/components/ui/Card";
import { useColors } from "@/theme/ThemeProvider";

type IconName = React.ComponentProps<typeof Feather>["name"];

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-11 font-extrabold text-ink-500 uppercase tracking-widest mb-2.5 mt-7 first:mt-0">
      {title}
    </Text>
  );
}

export function MenuRow({ icon, label, subtitle, right, onPress }: {
  icon: IconName;
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const T = useColors();
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? "button" : undefined} className="flex-row items-center gap-3 min-h-[56px] px-4 border-b border-ink-75 active:opacity-60">
      <View className="w-9 h-9 bg-white rounded-xl items-center justify-center">
        <Feather name={icon} size={16} color={T.black} />
      </View>
      <View className="flex-1">
        <Text className="text-15 font-semibold text-black">{label}</Text>
        {subtitle && <Text className="text-xs text-ink-400 mt-0.5">{subtitle}</Text>}
      </View>
      {right || (onPress && <Feather name="chevron-right" size={16} color={T.ink150} />)}
    </TouchableOpacity>
  );
}

/** Tappable card header that expands a section below it. */
export function CollapsibleHeader({ icon, title, subtitle, open, onToggle }: {
  icon: IconName;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
}) {
  const T = useColors();
  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <Card variant="elevated" className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-3 flex-1">
          <View className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
            <Feather name={icon} size={16} color={T.black} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-medium text-black">{title}</Text>
            <Text className="text-xs text-ink-400 mt-0.5" numberOfLines={2}>{subtitle}</Text>
          </View>
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={T.ink200} />
      </Card>
    </TouchableOpacity>
  );
}

export type Notice = (title: string, message: string) => void;

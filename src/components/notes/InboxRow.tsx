import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { InboxItem } from "@/stores/inbox-store";
import { useColors } from "@/theme/ThemeProvider";

const TYPE_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  notification: "bell", email: "mail", chat: "message-circle",
};
const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

interface Props {
  item: InboxItem;
  selecting: boolean;
  checked: boolean;
  onPress: (item: InboxItem) => void;
  onLongPress: (item: InboxItem) => void;
}

/** One inbox message. Memoized: toggling one selection re-renders one row. */
export const InboxRow = memo(function InboxRow({ item, selecting, checked, onPress, onLongPress }: Props) {
  const C = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      accessibilityRole={selecting ? "checkbox" : "button"}
      accessibilityState={selecting ? { checked } : undefined}
      accessibilityLabel={`${item.read ? "" : "Unread. "}${item.title}`}
      className="flex-row items-start gap-3 py-3 border-b border-ink-75"
    >
      {selecting ? (
        <View className={`w-6 h-6 mt-2 rounded-full border-2 items-center justify-center ${checked ? "bg-accent border-accent" : "border-ink-300"}`}>
          {checked ? <Feather name="check" size={13} color={C.onAccent} /> : null}
        </View>
      ) : null}
      <View className="w-10 h-10 rounded-[14px] bg-ink-50 items-center justify-center">
        <Feather name={TYPE_ICONS[item.type] || "bell"} size={16} color={item.read ? C.ink400 : C.black} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className={`text-sm flex-1 ${item.read ? "text-ink-600 font-medium" : "text-black font-extrabold"}`} numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-[11px] text-ink-400">{new Date(item.timestamp).toLocaleDateString(undefined, dateFmt)}</Text>
        </View>
        {item.body ? <Text className="text-[13px] text-ink-500" numberOfLines={2}>{item.body}</Text> : null}
        <Text className="text-[11px] text-ink-400">{item.source}</Text>
      </View>
      <View className={`w-2 h-2 rounded-full mt-4 ${item.read ? "bg-transparent" : "bg-accent"}`} />
    </TouchableOpacity>
  );
});

import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";

type IconName = React.ComponentProps<typeof Feather>["name"];

interface Props {
  editedLabel: string;
  paletteOpen: boolean;
  onAdd: () => void;
  onTogglePalette: () => void;
  onMore: () => void;
  background: string;
  bottomInset: number;
}

/**
 * Material 3 bottom app bar for the note editor. It's part of the normal
 * layout (not absolutely positioned), so it rides directly on top of the
 * keyboard and can never cover the text being typed.
 */
export const EditorBottomBar = memo(function EditorBottomBar({
  editedLabel, paletteOpen, onAdd, onTogglePalette, onMore, background, bottomInset,
}: Props) {
  return (
    <View
      className="flex-row items-center px-1.5 border-t border-ink-75"
      style={{ backgroundColor: background, paddingBottom: bottomInset, minHeight: 56 + bottomInset }}
    >
      <BarButton icon="plus-square" label="Add photo, file or scan" onPress={onAdd} />
      <BarButton icon="droplet" label="Note color" onPress={onTogglePalette} active={paletteOpen} />
      <Text className="flex-1 text-center text-xs font-medium text-ink-500" numberOfLines={1}>
        {editedLabel}
      </Text>
      <BarButton icon="more-vertical" label="More options" onPress={onMore} />
    </View>
  );
});

function BarButton({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active !== undefined ? { expanded: active } : undefined}
      className={`w-12 h-12 rounded-full items-center justify-center ${active ? "bg-black/10" : ""}`}
    >
      <Feather name={icon} size={21} color={C.ink800} />
    </TouchableOpacity>
  );
}

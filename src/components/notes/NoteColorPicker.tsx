import { memo } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "@/theme/ThemeProvider";
import { NOTE_COLORS, type NoteColorId } from "@/theme/note-colors";

interface Props {
  value: string | undefined;
  onChange: (id: NoteColorId) => void;
}

/** Horizontal row of note color swatches (Default first, shown as "no fill"). */
export const NoteColorPicker = memo(function NoteColorPicker({ value, onChange }: Props) {
  const { colors: C, dark } = useTheme();
  const current = value ?? "default";
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerClassName="px-4 gap-2.5 py-2"
      accessibilityRole="radiogroup"
      accessibilityLabel="Note color"
    >
      {NOTE_COLORS.map((c) => {
        const active = c.id === current;
        const fill = c.id === "default" ? C.white : dark ? c.dark : c.light;
        return (
          <TouchableOpacity
            key={c.id}
            onPress={() => onChange(c.id)}
            activeOpacity={0.75}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={c.name}
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{
              backgroundColor: fill,
              borderWidth: active ? 2 : 1,
              borderColor: active ? C.accent : C.ink150,
            }}
          >
            {c.id === "default" ? (
              <Feather name="slash" size={16} color={C.ink400} />
            ) : active ? (
              <Feather name="check" size={16} color={C.black} />
            ) : (
              <View />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

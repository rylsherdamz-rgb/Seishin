import { memo } from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";

interface Props {
  value: string;
  onChange: (q: string) => void;
  layout: "grid" | "list";
  onToggleLayout: () => void;
}

/** Material 3 search bar: full-width pill, leading search icon, trailing action. */
export const NotesSearchBar = memo(function NotesSearchBar({ value, onChange, layout, onToggleLayout }: Props) {
  const C = useColors();
  return (
    <View className="mx-4 h-14 rounded-full bg-ink-50 flex-row items-center pl-5 pr-1.5">
      <Feather name="search" size={20} color={C.ink700} />
      <TextInput
        className="flex-1 text-base text-black ml-3"
        placeholder="Search your notes"
        placeholderTextColor={C.ink500}
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
        accessibilityLabel="Search your notes"
      />
      {value ? (
        <TouchableOpacity onPress={() => onChange("")} accessibilityRole="button" accessibilityLabel="Clear search" className="w-11 h-11 rounded-full items-center justify-center">
          <Feather name="x" size={20} color={C.ink700} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onToggleLayout}
          accessibilityRole="button"
          accessibilityLabel={layout === "grid" ? "Switch to list view" : "Switch to grid view"}
          className="w-11 h-11 rounded-full items-center justify-center"
        >
          <Feather name={layout === "grid" ? "list" : "grid"} size={20} color={C.ink700} />
        </TouchableOpacity>
      )}
    </View>
  );
});

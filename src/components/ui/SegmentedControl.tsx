import { View, Text, TouchableOpacity } from "react-native";
import { useColors } from "@/theme/ThemeProvider";

interface SegmentedControlProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  size?: "small" | "medium";
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "medium",
}: SegmentedControlProps<T>) {
  const C = useColors();
  const height = size === "small" ? 36 : 44;
  const pillHeight = height - 8;

  return (
    <View
      className="flex-row bg-ink-50 rounded-2xl p-1"
      style={{ height }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="flex-1 items-center justify-center rounded-xl"
            style={{
              height: pillHeight,
              backgroundColor: active ? C.white : "transparent",
              shadowColor: active ? "#000000" : "transparent",
              shadowOpacity: active ? 0.08 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: active ? 2 : 0,
            }}
          >
            <Text
              className={`text-[13px] font-bold ${active ? "text-black" : "text-ink-500"}`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

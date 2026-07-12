import { View, Text, TouchableOpacity } from "react-native";

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
  const height = size === "small" ? 32 : 38;
  const pillHeight = height - 4;

  return (
    <View
      className="flex-row bg-ink-100 rounded-xl p-0.5"
      style={{ height }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            activeOpacity={0.8}
            className="flex-1 items-center justify-center rounded-lg"
            style={{
              height: pillHeight,
              backgroundColor: active ? "#ffffff" : "transparent",
              shadowColor: active ? "#000" : "transparent",
              shadowOpacity: active ? 0.08 : 0,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: active ? 2 : 0,
            }}
          >
            <Text
              className={`text-sm font-semibold ${active ? "text-black" : "text-ink-400"}`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

import { TouchableOpacity, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
  className?: string;
}

/**
 * Pill-style filter / segmented control chip. Active state uses the solid
 * ink surface with a soft lift; inactive stays quiet with a hairline border.
 */
export function Chip({
  label,
  active = false,
  onPress,
  disabled = false,
  icon,
  className = "",
}: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      className={`flex-row items-center gap-1.5 px-3.5 py-2 rounded-full ${
        active
          ? "bg-black shadow-subtle"
          : "bg-white border border-ink-200"
      } ${disabled ? "opacity-40" : ""} ${className}`}
    >
      {icon ? (
        <Feather name={icon} size={12} color={active ? "#ffffff" : "#999999"} />
      ) : null}
      <Text
        className={`text-xs font-semibold ${
          active ? "text-white" : "text-ink-500"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

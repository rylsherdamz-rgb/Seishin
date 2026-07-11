import { TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";

type IconButtonVariant = "solid" | "surface" | "plain";
type IconButtonSize = "sm" | "md";

interface IconButtonProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress?: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

const sizeMap: Record<IconButtonSize, { box: string; icon: number }> = {
  sm: { box: "w-9 h-9", icon: 14 },
  md: { box: "w-11 h-11", icon: 18 },
};

/**
 * Circular icon action button. `solid` = primary ink action (with lift),
 * `surface` = quiet gray affordance, `plain` = borderless.
 */
export function IconButton({
  icon,
  onPress,
  variant = "surface",
  size = "sm",
  active = false,
  disabled = false,
  className = "",
}: IconButtonProps) {
  const s = sizeMap[size];
  const solid = variant === "solid" || active;

  const surfaceStyle =
    variant === "plain"
      ? "bg-transparent"
      : solid
      ? "bg-black shadow-raised"
      : "bg-ink-100";

  const iconColor = solid ? "#ffffff" : variant === "plain" ? "#666666" : "#000000";

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      className={`${s.box} rounded-full items-center justify-center ${surfaceStyle} ${
        disabled ? "opacity-40" : ""
      } ${className}`}
    >
      <Feather name={icon} size={s.icon} color={iconColor} />
    </TouchableOpacity>
  );
}

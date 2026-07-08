import { TouchableOpacity, Text, View } from "react-native";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-black",
  secondary: "bg-transparent border border-black",
  ghost: "bg-transparent",
  destructive: "bg-black",
};

const textStyles: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-black",
  ghost: "text-ink-500",
  destructive: "text-white",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  icon,
  className = "",
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`h-12 px-6 items-center justify-center rounded-lg ${
        variantStyles[variant]
      } ${disabled ? "opacity-40" : ""} ${className}`}
    >
      <View className="flex-row items-center gap-2">
        {icon && icon}
        {title ? (
          <Text
            className={`text-base font-medium ${textStyles[variant]}`}
          >
            {title}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

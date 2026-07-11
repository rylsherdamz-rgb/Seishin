import { TouchableOpacity, Text, View, ActivityIndicator } from "react-native";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-black shadow-raised",
  secondary: "bg-white border border-ink-200 shadow-subtle",
  ghost: "bg-transparent",
  destructive: "bg-black shadow-raised",
};

const textStyles: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-black",
  ghost: "text-ink-500",
  destructive: "text-white",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-4 rounded-lg",
  md: "h-12 px-6 rounded-xl",
  lg: "h-14 px-7 rounded-xl",
};

const textSizeStyles: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-base",
};

const spinnerColor: Record<Variant, string> = {
  primary: "#ffffff",
  secondary: "#000000",
  ghost: "#666666",
  destructive: "#ffffff",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  fullWidth = true,
  icon,
  className = "",
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      className={`items-center justify-center flex-row ${sizeStyles[size]} ${
        variantStyles[variant]
      } ${fullWidth ? "w-full" : "self-start"} ${isDisabled ? "opacity-40" : ""} ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor[variant]} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          {title ? (
            <Text
              className={`font-semibold ${textSizeStyles[size]} ${textStyles[variant]}`}
            >
              {title}
            </Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

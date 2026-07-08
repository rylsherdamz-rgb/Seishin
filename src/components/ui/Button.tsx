import { TouchableOpacity, Text, View } from "react-native";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
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
  ghost: "text-gray-500",
  destructive: "text-white",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
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
      <Text
        className={`text-base font-medium ${textStyles[variant]} ${
          variant === "ghost" ? "underline" : ""
        }`}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

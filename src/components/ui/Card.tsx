import { View, Text, TouchableOpacity } from "react-native";

type CardVariant = "filled" | "elevated" | "outlined";

interface CardProps {
  title?: string;
  description?: string;
  caption?: string;
  variant?: CardVariant;
  onPress?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  // Documented default: soft gray surface. Slightly larger radius for a
  // more refined, contemporary feel — still strictly monochrome.
  filled: "bg-ink-100 rounded-card",
  // White surface lifted off the background with a hairline + soft shadow.
  elevated: "bg-white rounded-card border border-ink-100 shadow-card",
  // Quiet, bordered surface for grouping without weight.
  outlined: "bg-white rounded-card border border-ink-200",
};

export function Card({
  title,
  description,
  caption,
  variant = "filled",
  onPress,
  className = "",
  children,
}: CardProps) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      {...(onPress ? { activeOpacity: 0.7 } : {})}
      className={`p-4 ${variantStyles[variant]} ${className}`}
    >
      {title && (
        <Text className="text-base font-semibold text-black">{title}</Text>
      )}
      {description && (
        <Text className="text-sm text-ink-700 mt-1">{description}</Text>
      )}
      {caption && (
        <Text className="text-xs text-ink-300 mt-2">{caption}</Text>
      )}
      {children}
    </Wrapper>
  );
}

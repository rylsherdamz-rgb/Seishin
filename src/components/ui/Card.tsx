import { View, Text, TouchableOpacity } from "react-native";

interface CardProps {
  title?: string;
  description?: string;
  caption?: string;
  onPress?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function Card({
  title,
  description,
  caption,
  onPress,
  className = "",
  children,
}: CardProps) {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      className={`bg-ink-100 p-4 rounded-lg ${className}`}
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

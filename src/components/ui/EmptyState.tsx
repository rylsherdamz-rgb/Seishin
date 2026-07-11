import { View, Text } from "react-native";
import Feather from "@expo/vector-icons/Feather";

interface EmptyStateProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle?: string;
  className?: string;
}

/**
 * Consistent empty-list placeholder: a soft ink medallion with a hairline
 * ring, a title, and an optional hint. Used across every list screen.
 */
export function EmptyState({ icon, title, subtitle, className = "" }: EmptyStateProps) {
  return (
    <View className={`items-center justify-center py-20 px-8 ${className}`}>
      <View className="w-16 h-16 bg-ink-50 border border-ink-100 rounded-full items-center justify-center mb-4 shadow-subtle">
        <Feather name={icon} size={24} color="#cccccc" />
      </View>
      <Text className="text-base font-medium text-ink-400">{title}</Text>
      {subtitle ? (
        <Text className="text-sm text-ink-300 mt-1 text-center max-w-[260px]">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

import { View, Text } from "react-native";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Rendered on the left, before the title (e.g. a back button or logo). */
  leading?: React.ReactNode;
  /** Rendered on the right (e.g. action icon buttons). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent screen title block used across all top-level screens.
 * Monochrome, tight tracking, with an optional accent rule under the title
 * for a touch of editorial polish.
 */
export function ScreenHeader({
  title,
  subtitle,
  leading,
  actions,
  className = "",
}: ScreenHeaderProps) {
  return (
    <View className={`px-4 pt-3 pb-2 flex-row items-center gap-3 ${className}`}>
      {leading}
      <View className="flex-1">
        <Text className="text-2xl font-semibold tracking-tightest text-black">
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-ink-500 mt-0.5">{subtitle}</Text>
        ) : null}
      </View>
      {actions ? <View className="flex-row items-center gap-2">{actions}</View> : null}
    </View>
  );
}

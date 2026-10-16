import { memo } from "react";
import { View, Text } from "react-native";
import { categorizeModel, getTierLabel } from "@/services/nim-models";

// Full class strings (no interpolation) so Tailwind can see and generate them.
const STYLES = {
  fast: { box: "bg-success/15", text: "text-success" },
  balanced: { box: "bg-ink-100", text: "text-ink-600" },
  smart: { box: "bg-accent/15", text: "text-accent" },
  unknown: { box: "bg-ink-100", text: "text-ink-500" },
} as const;

export const TierBadge = memo(function TierBadge({ modelId, className = "" }: { modelId: string; className?: string }) {
  const tier = categorizeModel(modelId).tier;
  const s = STYLES[tier] ?? STYLES.unknown;
  return (
    <View className={`px-2 py-0.5 rounded-full ${s.box} ${className}`}>
      <Text className={`text-2xs font-semibold ${s.text}`}>{getTierLabel(tier)}</Text>
    </View>
  );
});

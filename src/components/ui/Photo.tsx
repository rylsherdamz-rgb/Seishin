import { memo } from "react";
import { Image } from "expo-image";
import type { StyleProp, ImageStyle } from "react-native";
import { useColors } from "@/theme/ThemeProvider";

interface PhotoProps {
  uri: string;
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Local/remote photo thumbnail backed by expo-image: decoded off the JS
 * thread, downsampled to the view size and cached in memory + disk, so long
 * lists of note photos scroll without jank or re-decoding. `recyclingKey`
 * stops a recycled list cell from flashing the previous row's image.
 */
export const Photo = memo(function Photo({ uri, width, height, radius = 12, style }: PhotoProps) {
  const C = useColors();
  return (
    <Image
      source={{ uri }}
      recyclingKey={uri}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={120}
      style={[{ width, height, borderRadius: radius, backgroundColor: C.ink100 }, style]}
      accessibilityIgnoresInvertColors
    />
  );
});

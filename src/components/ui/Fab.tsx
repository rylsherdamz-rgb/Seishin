import { TouchableOpacity } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";

interface FabProps {
  icon?: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  /** Extra distance from the bottom edge (e.g. above a composer). */
  bottom?: number;
}

/** Primary floating action — one per screen, bottom-right, accent colored. */
export function Fab({ icon = "plus", label, onPress, bottom = 20 }: FabProps) {
  const C = useColors();
  return (
    <Animated.View entering={ZoomIn.delay(120).duration(220)} className="absolute right-5" style={{ bottom }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="w-[60px] h-[60px] rounded-[20px] bg-accent items-center justify-center shadow-float"
      >
        <Feather name={icon} size={26} color={C.onAccent} />
      </TouchableOpacity>
    </Animated.View>
  );
}

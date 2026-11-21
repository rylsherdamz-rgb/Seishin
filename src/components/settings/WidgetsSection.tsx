import { View, Text, TouchableOpacity, Alert, Platform } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";

type IconName = React.ComponentProps<typeof Feather>["name"];

const WIDGETS: { name: string; icon: IconName; label: string; sub: string }[] = [
  { name: "Agenda", icon: "sun", label: "Today", sub: "Today's and tomorrow's events and deadlines" },
  { name: "Month", icon: "calendar", label: "Month", sub: "Month calendar with event dots" },
  { name: "Tasks", icon: "check-circle", label: "Tasks", sub: "Tick tasks off right from the home screen" },
  { name: "NextUp", icon: "clock", label: "Next up", sub: "Small countdown to your next thing" },
  { name: "Quick", icon: "plus-circle", label: "Quick add", sub: "New event, task, scan or note in one tap" },
];

async function pin(name: string, label: string) {
  try {
    const { requestPinWidget } = require("react-native-android-widget") as typeof import("react-native-android-widget");
    const ok = await requestPinWidget({ widgetName: name });
    if (!ok) throw new Error("unsupported");
  } catch {
    Alert.alert(
      "Add it from your home screen",
      `Long-press an empty spot on your home screen > Widgets > Seishin > "${label}".`,
    );
  }
}

/** Settings block: put Seishin widgets on the home screen (Android). */
export function WidgetsSection() {
  const C = useColors();
  if (Platform.OS !== "android") return null;
  return (
    <View className="rounded-[20px] bg-ink-50 overflow-hidden mb-4">
      {WIDGETS.map((w, i) => (
        <View key={w.name}>
          {i > 0 ? <View className="h-px bg-ink-75 mx-4" /> : null}
          <TouchableOpacity onPress={() => pin(w.name, w.label)} accessibilityRole="button" accessibilityLabel={`Add ${w.label} widget`} className="flex-row items-center gap-3 min-h-[60px] px-4">
            <View className="w-9 h-9 bg-white rounded-xl items-center justify-center">
              <Feather name={w.icon} size={16} color={C.black} />
            </View>
            <View className="flex-1">
              <Text className="text-[15px] font-semibold text-black">{w.label}</Text>
              <Text className="text-xs mt-0.5 text-ink-500">{w.sub}</Text>
            </View>
            <View className="h-8 px-3 rounded-full bg-white items-center justify-center">
              <Text className="text-xs font-semibold text-black">Add</Text>
            </View>
          </TouchableOpacity>
        </View>
      ))}
      <Text className="text-xs text-ink-500 px-4 pb-3 pt-1">Widgets follow your theme and update as your calendar and tasks change.</Text>
    </View>
  );
}

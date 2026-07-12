import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: "calendar", inactive: "calendar-outline" },
  notes: { active: "document-text", inactive: "document-text-outline" },
  agent: { active: "flash", inactive: "flash-outline" },
  music: { active: "musical-notes", inactive: "musical-notes-outline" },
  settings: { active: "settings", inactive: "settings-outline" },
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <>
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#000000",
        tabBarInactiveTintColor: "#999999",
        tabBarIcon: ({ color, size, focused }) => {
          const pair = icons[route.name];
          if (!pair) return null;
          return <Ionicons name={focused ? pair.active : pair.inactive} size={size} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#eeeeee",
          borderTopWidth: 1,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 14 : 22,
          paddingTop: 8,
          elevation: 12,
          shadowColor: "#000000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
          letterSpacing: -0.1,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Calendar" }} />
      <Tabs.Screen name="notes" options={{ title: "Notes" }} />
      <Tabs.Screen name="agent" options={{ title: "Agent" }} />
      <Tabs.Screen name="music" options={{ title: "Music" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
    </>
  );
}

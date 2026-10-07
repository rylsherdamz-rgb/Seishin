import { View } from "react-native";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/theme/ThemeProvider";


const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: "calendar", inactive: "calendar-outline" },
  notes: { active: "document-text", inactive: "document-text-outline" },
  agent: { active: "flash", inactive: "flash-outline" },
  settings: { active: "settings", inactive: "settings-outline" },
};

export default function TabLayout() {
  const T = useColors();
  return (
    <View className="flex-1" style={{ backgroundColor: T.white }}>
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <Tabs
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: T.accent,
            tabBarInactiveTintColor: T.ink300,
            tabBarIcon: ({ color, size, focused }) => {
              const pair = icons[route.name];
              if (!pair) return null;
              return <Ionicons name={focused ? pair.active : pair.inactive} size={size} color={color} />;
            },
            tabBarStyle: {
              backgroundColor: T.white,
              borderTopColor: T.ink75,
              borderTopWidth: 1,
              height: 68,
              paddingTop: 8,
              paddingBottom: 8,
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
          <Tabs.Screen name="settings" options={{ title: "Settings" }} />
        </Tabs>
      </SafeAreaView>
    </View>
  );
}

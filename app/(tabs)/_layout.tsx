import { View } from "react-native";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/theme/ThemeProvider";
import { useInboxStore } from "@/stores/inbox-store";

const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: "calendar", inactive: "calendar-outline" },
  notes: { active: "document-text", inactive: "document-text-outline" },
  agent: { active: "flash", inactive: "flash-outline" },
  settings: { active: "settings", inactive: "settings-outline" },
};

export default function TabLayout() {
  const T = useColors();
  // Number selector: the layout only re-renders when the unread count changes.
  const unread = useInboxStore((s) => s.items.reduce((n, i) => n + (i.read ? 0 : 1), 0));
  return (
    <View className="flex-1" style={{ backgroundColor: T.white }}>
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <Tabs
          screenOptions={({ route }) => ({
            headerShown: false,
            // Hidden tabs stop re-rendering (react-native-screens freeze), so a
            // store change on one tab doesn't re-render every other tab too.
            freezeOnBlur: true,
            tabBarActiveTintColor: T.black,
            tabBarInactiveTintColor: T.ink500,
            tabBarIcon: ({ color, size, focused }) => {
              const pair = icons[route.name];
              if (!pair) return null;
              return (
                <View className="items-center">
                  <Ionicons name={focused ? pair.active : pair.inactive} size={size - 1} color={color} />
                </View>
              );
            },
            tabBarStyle: {
              backgroundColor: T.white,
              borderTopColor: T.ink75,
              borderTopWidth: 1,
              height: 68,
              paddingTop: 8,
              paddingBottom: 10,
              elevation: 0,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "700",
              marginTop: 2,
            },
            tabBarItemStyle: {
              paddingVertical: 2,
            },
            tabBarBadgeStyle: {
              backgroundColor: T.accent,
              color: T.onAccent,
              fontSize: 10,
              fontWeight: "800",
            },
          })}
        >
          <Tabs.Screen name="index" options={{ title: "Calendar", tabBarAccessibilityLabel: "Calendar" }} />
          <Tabs.Screen
            name="notes"
            options={{
              title: "Notes",
              tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
              tabBarAccessibilityLabel: unread > 0 ? `Notes, ${unread} unread in inbox` : "Notes",
            }}
          />
          <Tabs.Screen name="agent" options={{ title: "Agent", tabBarAccessibilityLabel: "AI agent" }} />
          <Tabs.Screen name="settings" options={{ title: "Settings", tabBarAccessibilityLabel: "Settings" }} />
        </Tabs>
      </SafeAreaView>
    </View>
  );
}

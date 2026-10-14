import { useEffect } from "react";
import { View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCalendarStore } from "@/stores/calendar-store";
import { dateKey } from "@/utils/recurrence";

/**
 * Landing route for home-screen widget taps (seishin://open?to=…). Translates
 * the request into a normal navigation so widgets never depend on screen
 * internals.
 */
export default function OpenRoute() {
  const p = useLocalSearchParams<{ to?: string; date?: string; id?: string; source?: string }>();

  useEffect(() => {
    const date = p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : dateKey(new Date());
    switch (p.to) {
      case "task":
        if (p.id) {
          router.replace("/(tabs)");
          router.push({ pathname: "/task", params: { id: p.id } });
          return;
        }
        break;
      case "tasks":
        router.replace("/(tabs)");
        router.push("/todo");
        return;
      case "new-task":
        router.replace("/(tabs)");
        router.push({ pathname: "/todo", params: { add: "1" } });
        return;
      case "new-note":
        router.replace("/(tabs)");
        router.push("/note");
        return;
      case "capture":
        router.replace("/(tabs)");
        router.push({ pathname: "/capture", params: { source: p.source ?? "camera" } });
        return;
      case "new-event":
        useCalendarStore.getState().setSelectedDate(date);
        router.replace({ pathname: "/(tabs)", params: { create: "event", at: String(Date.now()) } });
        return;
      case "day":
        useCalendarStore.getState().setSelectedDate(date);
        router.replace({ pathname: "/(tabs)", params: { at: String(Date.now()) } });
        return;
    }
    router.replace("/(tabs)");
    // Navigate once per link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false, animation: "none" }} />
    </View>
  );
}

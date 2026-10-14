import { useState } from "react";
import { View, Text, TouchableOpacity, Alert, Linking, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { ensureEventChannels, ensureNotificationPermission, REMINDER_CHANNEL } from "@/services/notify-core";

type IconName = React.ComponentProps<typeof Feather>["name"];

/**
 * "Why didn't my reminder ring?" — a test notification plus shortcuts to the
 * system switches that silence reminders (permission, battery saver).
 */
export function RemindersCheck() {
  const C = useColors();
  const [sent, setSent] = useState(false);

  const test = async () => {
    if (!(await ensureNotificationPermission())) {
      Alert.alert("Notifications are off", "Turn on notifications for Seishin, or reminders can't show.", [
        { text: "Cancel", style: "cancel" },
        { text: "Open settings", onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    await ensureEventChannels();
    await Notifications.scheduleNotificationAsync({
      content: { title: "Reminders are working", body: "This is how your event and deadline reminders will look.", data: { type: "test" } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: Platform.OS === "android" ? REMINDER_CHANNEL : undefined,
      },
    });
    setSent(true);
  };

  const battery = () => {
    Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS").catch(() => Linking.openSettings());
  };

  return (
    <View className="rounded-[20px] bg-ink-50 overflow-hidden mb-4">
      <Row C={C} icon="bell" label="Send a test reminder" sub={sent ? "Arrives in 5 seconds — lock the phone to see it" : "Check that reminders show on this phone"} onPress={test} />
      <View className="h-px bg-ink-75 mx-4" />
      <Row C={C} icon="settings" label="Notification settings" sub="Allow notifications, sound and pop-up" onPress={() => Linking.openSettings()} />
      {Platform.OS === "android" ? (
        <>
          <View className="h-px bg-ink-75 mx-4" />
          <Row C={C} icon="battery" label="Battery optimization" sub="Set Seishin to “Unrestricted” so reminders and sync run on time" onPress={battery} />
        </>
      ) : null}
    </View>
  );
}

function Row({ C, icon, label, sub, onPress }: { C: ReturnType<typeof useColors>; icon: IconName; label: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" className="flex-row items-center gap-3 min-h-[60px] px-4">
      <View className="w-9 h-9 bg-white rounded-xl items-center justify-center">
        <Feather name={icon} size={16} color={C.black} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-black">{label}</Text>
        <Text className="text-xs mt-0.5 text-ink-500">{sub}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={C.ink300} />
    </TouchableOpacity>
  );
}

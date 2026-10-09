import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import NotificationListener from "expo-android-notification-listener-service";
import { useColors } from "@/theme/ThemeProvider";
import { useSettingsStore } from "@/stores/settings-store";
import { CalendarConnector } from "@/components/connectors/CalendarConnector";

type IconName = React.ComponentProps<typeof Feather>["name"];

/** Everything Seishin can pull your life in from, in one place. */
export default function ConnectorsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const nimKey = useSettingsStore((s) => s.apiKeys.nim);
  const modelPath = useSettingsStore((s) => s.modelPath);
  const [notifOn, setNotifOn] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    try {
      setNotifOn(NotificationListener.isNotificationPermissionGranted());
    } catch {
      setNotifOn(false);
    }
  }, []);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center h-14 px-1">
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" className="w-12 h-12 items-center justify-center">
          <Feather name="arrow-left" size={22} color={C.ink800} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-black">Connectors</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 24, gap: 12 }}>
        <Text className="text-sm text-ink-600 px-1 leading-5">
          Connect the places your schedule and schoolwork live. Everything stays on this phone.
        </Text>

        <Card icon="calendar" title="Calendars" subtitle="Google · Outlook · Samsung — two-way">
          <CalendarConnector />
        </Card>

        <Card icon="hard-drive" title="Google Drive & files" subtitle="OneDrive, Dropbox and any file app too">
          <Text className="text-sm text-ink-600 leading-5">
            Pick photos or PDFs straight from Drive — Seishin reads them, finds what's due and sets reminders.
          </Text>
          <Action icon="folder" label="Import from Drive or files" onPress={() => router.push({ pathname: "/capture", params: { source: "files" } })} />
        </Card>

        <Card icon="camera" title="Camera & photos" subtitle="Dump pictures of assignments, notices, posters">
          <View className="flex-row gap-2 mt-1">
            <Action icon="camera" label="Take photo" onPress={() => router.push({ pathname: "/capture", params: { source: "camera" } })} flex />
            <Action icon="image" label="Choose photos" onPress={() => router.push({ pathname: "/capture", params: { source: "photos" } })} flex />
          </View>
        </Card>

        {Platform.OS === "android" ? (
          <Card icon="bell" title="Phone notifications" subtitle={notifOn ? "Connected" : "Not connected"} ok={notifOn}>
            <Text className="text-sm text-ink-600 leading-5">
              Messages from Classroom, Messenger, email and other apps land in your Inbox, and dates in them become suggested events.
            </Text>
            {!notifOn ? (
              <Action icon="settings" label="Allow notification access" onPress={() => { try { NotificationListener.openNotificationListenerSettings(); } catch { /* unavailable */ } }} />
            ) : null}
          </Card>
        ) : null}

        <Card
          icon="zap"
          title="AI reading"
          subtitle={nimKey ? "Cloud model connected" : modelPath ? "On-device model" : "Offline rules only"}
          ok={!!(nimKey || modelPath)}
        >
          <Text className="text-sm text-ink-600 leading-5">
            Smart capture always works offline. Adding an NVIDIA NIM key or an on-device model makes it better at spotting questions and deadlines.
          </Text>
          <Action icon="sliders" label="AI settings" onPress={() => router.push("/settings")} />
        </Card>
      </ScrollView>
    </View>
  );
}

function Card({ icon, title, subtitle, ok, children }: { icon: IconName; title: string; subtitle: string; ok?: boolean; children: React.ReactNode }) {
  const C = useColors();
  return (
    <View className="rounded-[20px] border border-ink-100 p-4">
      <View className="flex-row items-center gap-3 mb-3">
        <View className="w-11 h-11 rounded-2xl bg-ink-50 items-center justify-center">
          <Feather name={icon} size={20} color={C.black} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-black">{title}</Text>
          <View className="flex-row items-center gap-1.5">
            {ok !== undefined ? <View className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-success" : "bg-ink-300"}`} /> : null}
            <Text className="text-xs text-ink-500">{subtitle}</Text>
          </View>
        </View>
      </View>
      {children}
    </View>
  );
}

function Action({ icon, label, onPress, flex }: { icon: IconName; label: string; onPress: () => void; flex?: boolean }) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      className={`mt-3 h-11 rounded-xl bg-ink-50 flex-row items-center justify-center gap-2 px-3 ${flex ? "flex-1" : ""}`}
    >
      <Feather name={icon} size={15} color={C.black} />
      <Text className="text-[13px] font-semibold text-black">{label}</Text>
    </TouchableOpacity>
  );
}

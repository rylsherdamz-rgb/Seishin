import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import * as Application from "expo-application";
import { useSettingsStore } from "@/stores/settings-store";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { Card } from "@/components/ui/Card";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Logo } from "@/components/Logo";
import { AppearancePicker } from "@/components/AppearancePicker";
import { DisplayControls } from "@/components/settings/DisplayControls";
import { BackupSection } from "@/components/BackupSection";
import { WidgetsSection } from "@/components/settings/WidgetsSection";
import { AiSection } from "@/components/settings/AiSection";
import { RemindersSection } from "@/components/settings/RemindersSection";
import { StorageSection } from "@/components/settings/StorageSection";
import { MenuRow, SectionHeader } from "@/components/settings/rows";

/** "1.0.0 (5)": app version plus the build's versionCode, so a bug report names the exact APK. */
const versionLabel = () => {
  const v = Application.nativeApplicationVersion ?? "1.0.0";
  const b = Application.nativeBuildVersion;
  return b ? `v${v} (${b})` : `v${v}`;
};

export default function SettingsScreen() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const keyboardPadding = useKeyboardPadding();
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const showNotice = useCallback((title: string, message: string) => setNotice({ title, message }), []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} alwaysBounceVertical contentContainerStyle={{ paddingBottom: keyboardPadding }}>
        <View className="px-5 pb-12">
          <View className="flex-row items-center gap-3 mb-6 pt-3">
            <Logo size={32} />
            <View>
              <Text className="text-[30px] font-extrabold tracking-tightest text-black">Settings</Text>
              <Text className="text-sm text-ink-400">App configuration</Text>
            </View>
          </View>

          <SectionHeader title="Appearance" />
          <Card variant="elevated" className="mb-4">
            <AppearancePicker />
          </Card>
          <Card variant="elevated" className="mb-4">
            <DisplayControls />
          </Card>

          <SectionHeader title="Quick Access" />
          <Card className="mb-4 p-0 overflow-hidden">
            <MenuRow icon="link" label="Connectors" subtitle="Google Calendar, Todoist, Notion and feeds" onPress={() => router.push("/connectors")} />
            <MenuRow icon="zap" label="Smart capture" subtitle="Turn assignment photos into tasks + reminders" onPress={() => router.push("/capture")} />
            <MenuRow icon="check-square" label="Tasks" subtitle="Your task list and due dates" onPress={() => router.push("/todo")} />
            <MenuRow icon="send" label="Invites" subtitle="Invitation cards and P2P codes" onPress={() => router.push("/invites")} />
          </Card>

          <AiSection onNotice={showNotice} />
          <RemindersSection onNotice={showNotice} />

          {Platform.OS === "android" ? <SectionHeader title="Home screen widgets" /> : null}
          <WidgetsSection />

          <SectionHeader title="Backup & restore" />
          <BackupSection />

          <StorageSection onNotice={showNotice} />

          <SectionHeader title="About" />
          <Card variant="elevated">
            <View className="flex-row items-center gap-4">
              <Logo size={44} />
              <View className="flex-1">
                <Text className="text-lg font-semibold text-black">Seishin</Text>
                <Text className="text-xs text-ink-400">{versionLabel()}</Text>
                <Text className="text-xs text-ink-300 mt-1">Serverless life manager</Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>

      <AlertDialog visible={notice !== null} onClose={() => setNotice(null)} title={notice?.title} message={notice?.message} />
    </View>
  );
}

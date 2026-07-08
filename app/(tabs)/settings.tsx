import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert, Switch } from "react-native";
import { useSettingsStore } from "@/stores/settings-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { useInboxStore } from "@/stores/inbox-store";
import { useAgentStore } from "@/stores/agent-store";
import {
  getStorageSizes,
  clearAllStorage,
  eventsStorage,
  messagesStorage,
  emailsStorage,
  notificationsStorage,
  agentStorage,
  ocrStorage,
  todosStorage,
  invitesStorage,
} from "@/stores/mmkv";
import { clearOcrHistory } from "@/services/ocr";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SettingsScreen() {
  const { loadSettings, cleanupPolicies, setCleanupPolicies } = useSettingsStore();
  const [sizes, setSizes] = useState<Record<string, number>>({});

  useEffect(() => {
    loadSettings();
    setSizes(getStorageSizes());
  }, []);

  function confirmClear(title: string, onClear: () => void) {
    Alert.alert(
      `Clear ${title}`,
      "This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: () => { onClear(); setSizes(getStorageSizes()); } },
      ]
    );
  }

  function confirmFactoryReset() {
    Alert.alert(
      "Factory Reset",
      "This will delete ALL data including downloaded AI models. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: () => {
            clearAllStorage();
            clearOcrHistory();
            setSizes(getStorageSizes());
            Alert.alert("Done", "All data has been cleared.");
          },
        },
      ]
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-8">
        <Text className="text-2xl font-semibold text-black mb-6">Settings</Text>

        {/* Storage Management */}
        <Text className="text-sm text-gray-500 uppercase tracking-wider mb-3">
          Storage Management
        </Text>

        {[
          { label: "Calendar Events", key: "events", storage: eventsStorage },
          { label: "Messages", key: "messages", storage: messagesStorage },
          { label: "Email Cache", key: "emails", storage: emailsStorage },
          { label: "Notifications", key: "notifications", storage: notificationsStorage },
          { label: "Agent Memory", key: "agent", storage: agentStorage },
          { label: "OCR History", key: "ocr", storage: ocrStorage },
          { label: "Todo Lists", key: "todos", storage: todosStorage },
          { label: "Invites", key: "invites", storage: invitesStorage },
        ].map(({ label, key, storage }) => (
          <Card key={key} className="mb-2 flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-sm font-medium text-black">{label}</Text>
              <Text className="text-xs text-gray-400">
                {sizes[key] ?? 0} items
              </Text>
            </View>
            <Button
              title="Clear"
              variant="ghost"
              onPress={() => confirmClear(label.toLowerCase(), () => storage.clearAll())}
            />
          </Card>
        ))}

        <Button
          title="Factory Reset — Delete All Data"
          variant="destructive"
          onPress={confirmFactoryReset}
          className="mt-4"
        />

        {/* Auto-Cleanup */}
        <Text className="text-sm text-gray-500 uppercase tracking-wider mb-3 mt-8">
          Auto-Cleanup (days before deletion)
        </Text>

        {[
          { label: "Notifications", key: "notificationsDays" as const },
          { label: "Email Cache", key: "emailsDays" as const },
          { label: "Chat Messages", key: "chatDays" as const },
          { label: "OCR Images", key: "ocrDays" as const },
        ].map(({ label, key }) => (
          <View key={key} className="flex-row items-center justify-between py-3 border-b border-ink-200">
            <Text className="text-sm text-black">{label}</Text>
            <View className="flex-row items-center gap-2">
              <Button
                title="–"
                variant="ghost"
                onPress={() =>
                  setCleanupPolicies({
                    [key]: Math.max(1, cleanupPolicies[key] - 1),
                  })
                }
              />
              <Text className="text-sm text-black w-8 text-center">
                {cleanupPolicies[key]}
              </Text>
              <Button
                title="+"
                variant="ghost"
                onPress={() =>
                  setCleanupPolicies({
                    [key]: Math.min(365, cleanupPolicies[key] + 1),
                  })
                }
              />
            </View>
          </View>
        ))}

        {/* AI Settings */}
        <Text className="text-sm text-gray-500 uppercase tracking-wider mb-3 mt-8">
          AI Provider
        </Text>

        <Card>
          <Text className="text-sm font-medium text-black mb-2">
            NVIDIA NIM API Key
          </Text>
          <Text className="text-xs text-gray-400">
            Set in environment or leave empty for offline-only mode
          </Text>
        </Card>

        {/* Notification Listener */}
        <Text className="text-sm text-gray-500 uppercase tracking-wider mb-3 mt-8">
          Notification Listener
        </Text>

        <Card>
          <Text className="text-sm font-medium text-black">
            Android Notification Access
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            Enable in Settings → Notification Access to auto-detect schedule events from all apps
          </Text>
        </Card>

        {/* About */}
        <Text className="text-sm text-gray-500 uppercase tracking-wider mb-3 mt-8">
          About
        </Text>

        <Card>
          <Text className="text-sm text-black">Seishin v1.0.0</Text>
          <Text className="text-xs text-gray-400 mt-1">
            Serverless mobile life manager
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}

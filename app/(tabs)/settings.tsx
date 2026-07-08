import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity } from "react-native";
import { useSettingsStore } from "@/stores/settings-store";
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
import { Logo } from "@/components/Logo";
import Feather from "@expo/vector-icons/Feather";

const storageCategories = [
  { label: "Calendar Events", key: "events" as const, storage: eventsStorage, icon: "calendar" as const },
  { label: "Messages", key: "messages" as const, storage: messagesStorage, icon: "message-circle" as const },
  { label: "Email Cache", key: "emails" as const, storage: emailsStorage, icon: "mail" as const },
  { label: "Notifications", key: "notifications" as const, storage: notificationsStorage, icon: "bell" as const },
  { label: "Agent Memory", key: "agent" as const, storage: agentStorage, icon: "cpu" as const },
  { label: "OCR History", key: "ocr" as const, storage: ocrStorage, icon: "camera" as const },
  { label: "Todo Lists", key: "todos" as const, storage: todosStorage, icon: "check-square" as const },
  { label: "Invites", key: "invites" as const, storage: invitesStorage, icon: "send" as const },
];

export default function SettingsScreen() {
  const { loadSettings, cleanupPolicies, setCleanupPolicies } = useSettingsStore();
  const [sizes, setSizes] = useState<Record<string, number>>({});

  useEffect(() => {
    loadSettings();
    setSizes(getStorageSizes());
  }, []);

  function confirmClear(title: string, onClear: () => void) {
    Alert.alert("Clear " + title, "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => { onClear(); setSizes(getStorageSizes()); } },
    ]);
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
        <Text className="text-2xl font-semibold tracking-tight text-black mb-1">Settings</Text>
        <Text className="text-sm text-ink-500 mb-6">App configuration and storage management</Text>

        <Text className="text-xs font-medium text-ink-300 uppercase tracking-widest mb-3">Storage</Text>

        {storageCategories.map(({ label, key, storage, icon }) => (
          <Card key={key} className="flex-row items-center gap-3 mb-2">
            <View className="w-9 h-9 bg-white rounded-full items-center justify-center">
              <Feather name={icon} size={14} color="#000000" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-black">{label}</Text>
              <Text className="text-xs text-ink-300">{sizes[key] ?? 0} items</Text>
            </View>
            <TouchableOpacity
              onPress={() => confirmClear(label, () => storage.clearAll())}
            >
              <Text className="text-xs text-ink-500 underline">Clear</Text>
            </TouchableOpacity>
          </Card>
        ))}

        <Button
          title="Factory Reset — Delete All Data"
          variant="destructive"
          onPress={confirmFactoryReset}
          icon={<Feather name="alert-triangle" size={14} color="#ffffff" />}
          className="mt-4"
        />

        <Text className="text-xs font-medium text-ink-300 uppercase tracking-widest mb-3 mt-8">
          Auto-Cleanup
        </Text>
        <Text className="text-xs text-ink-300 mb-3">Days before automatic deletion</Text>

        {([
          { label: "Notifications", key: "notificationsDays" as const },
          { label: "Email Cache", key: "emailsDays" as const },
          { label: "Chat Messages", key: "chatDays" as const },
          { label: "OCR Images", key: "ocrDays" as const },
        ]).map(({ label, key }) => (
          <View key={key} className="flex-row items-center justify-between py-3 border-b border-ink-200">
            <Text className="text-sm text-black">{label}</Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => setCleanupPolicies({ [key]: Math.max(1, cleanupPolicies[key] - 1) })}
                className="w-7 h-7 bg-ink-100 rounded-full items-center justify-center"
              >
                <Feather name="minus" size={12} color="#666666" />
              </TouchableOpacity>
              <Text className="text-sm font-medium text-black w-6 text-center">
                {cleanupPolicies[key]}
              </Text>
              <TouchableOpacity
                onPress={() => setCleanupPolicies({ [key]: Math.min(365, cleanupPolicies[key] + 1) })}
                className="w-7 h-7 bg-ink-100 rounded-full items-center justify-center"
              >
                <Feather name="plus" size={12} color="#666666" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text className="text-xs font-medium text-ink-300 uppercase tracking-widest mb-3 mt-8">
          AI Provider
        </Text>

        <Card>
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 bg-white rounded-full items-center justify-center">
              <Feather name="key" size={14} color="#000000" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-black">NVIDIA NIM Key</Text>
              <Text className="text-xs text-ink-500 mt-0.5">
                {useSettingsStore.getState().apiKeys.nim ? "Configured" : "Not set — offline mode"}
              </Text>
            </View>
          </View>
        </Card>

        <Text className="text-xs font-medium text-ink-300 uppercase tracking-widest mb-3 mt-8">
          Notification Listener
        </Text>

        <Card>
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 bg-white rounded-full items-center justify-center">
              <Feather name="bell" size={14} color="#000000" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-black">Android Access</Text>
              <Text className="text-xs text-ink-500 mt-0.5">
                Enable in Settings → Notification Access
              </Text>
            </View>
          </View>
        </Card>

        <Text className="text-xs font-medium text-ink-300 uppercase tracking-widest mb-3 mt-8">
          About
        </Text>

        <Card>
          <View className="flex-row items-center gap-4">
            <Logo size={40} />
            <View className="flex-1">
              <Text className="text-sm font-medium text-black">Seishin</Text>
              <Text className="text-xs text-ink-500">v1.0.0</Text>
              <Text className="text-xs text-ink-300 mt-0.5">Serverless life manager</Text>
            </View>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

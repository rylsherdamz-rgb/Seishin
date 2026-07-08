import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useSettingsStore } from "@/stores/settings-store";
import {
  getStorageSizes, clearAllStorage,
  eventsStorage, messagesStorage, emailsStorage,
  notificationsStorage, agentStorage, ocrStorage, todosStorage, invitesStorage,
} from "@/stores/mmkv";
import { clearOcrHistory } from "@/services/ocr";
import { useNotifications } from "@/services/notification-service";
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

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-medium text-ink-300 uppercase tracking-widest mb-3 mt-8 first:mt-0">
      {title}
    </Text>
  );
}

function MenuRow({
  icon, label, subtitle, right, onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} className="flex-row items-center gap-3 py-3.5 border-b border-ink-100 active:opacity-60">
      <View className="w-9 h-9 bg-ink-100 rounded-xl items-center justify-center">
        <Feather name={icon} size={14} color="#000000" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium text-black">{label}</Text>
        {subtitle && <Text className="text-xs text-ink-400 mt-0.5">{subtitle}</Text>}
      </View>
      {right || (onPress && <Feather name="chevron-right" size={16} color="#d0d0d0" />)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { loadSettings, cleanupPolicies, setCleanupPolicies, apiKeys, setApiKey, nimEndpoint, setNimEndpoint, modelPath, setModelPath } = useSettingsStore();
  const { isGranted, openSettings } = useNotifications();
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [nimKey, setNimKey] = useState("");
  const [nimEp, setNimEp] = useState("");
  const [ggufPath, setGgufPath] = useState("");
  const [showStorage, setShowStorage] = useState(false);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
    setSizes(getStorageSizes());
    isGranted().then(setNotifEnabled);
  }, []);

  useEffect(() => {
    setNimKey(apiKeys.nim);
    setNimEp(nimEndpoint);
    setGgufPath(modelPath || "");
  }, [apiKeys.nim, nimEndpoint, modelPath]);

  function confirmClear(title: string, onClear: () => void) {
    Alert.alert("Clear " + title, "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => { onClear(); setSizes(getStorageSizes()); } },
    ]);
  }

  function confirmFactoryReset() {
    Alert.alert("Factory Reset", "This will delete ALL data. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset", style: "destructive",
        onPress: () => {
          clearAllStorage();
          clearOcrHistory();
          setSizes(getStorageSizes());
          Alert.alert("Done", "All data has been cleared.");
        },
      },
    ]);
  }

  function saveNimKey() {
    setApiKey("nim", nimKey);
    setNimEndpoint(nimEp);
    Alert.alert("Saved", "NVIDIA NIM key and endpoint updated. Switch to NIM mode in the Agent tab.");
  }

  function saveModelPath() {
    setModelPath(ggufPath || null);
    Alert.alert("Saved", "Local model path updated.");
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pb-12">
          <View className="flex-row items-center gap-3 mb-6 pt-2">
            <Logo size={32} />
            <View>
              <Text className="text-2xl font-semibold tracking-tight text-black">Settings</Text>
              <Text className="text-sm text-ink-400">App configuration</Text>
            </View>
          </View>

          <SectionHeader title="Quick Access" />
          <Card className="mb-4 p-0 overflow-hidden">
            <MenuRow icon="check-square" label="Todo List" subtitle="Manage tasks with dates" onPress={() => router.push("/todo")} />
            <MenuRow icon="send" label="Invites" subtitle="Invitation cards and P2P codes" onPress={() => router.push("/invites")} />
          </Card>

          <SectionHeader title="AI Configuration" />
          <TouchableOpacity onPress={() => setShowAiConfig(!showAiConfig)} activeOpacity={0.7}>
            <Card className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center">
                  <Feather name="cpu" size={16} color="#000000" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-black">AI Provider</Text>
                  <Text className="text-xs text-ink-400 mt-0.5">
                    {apiKeys.nim ? "NVIDIA NIM ready" : "No key set"}
                    {modelPath ? " · GGUF path set" : ""}
                  </Text>
                </View>
              </View>
              <Feather name={showAiConfig ? "chevron-up" : "chevron-down"} size={18} color="#bbbbbb" />
            </Card>
          </TouchableOpacity>

          {showAiConfig && (
            <Card className="mb-4">
              <Text className="text-xs font-semibold text-ink-400 mb-2">NVIDIA NIM API Key</Text>
              <TextInput
                className="h-11 bg-white border border-ink-200 rounded-xl px-4 text-sm text-black mb-2"
                placeholder="Enter your NVIDIA NIM key..."
                placeholderTextColor="#bbbbbb"
                value={nimKey}
                onChangeText={setNimKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Text className="text-xs font-semibold text-ink-400 mb-2 mt-3">NIM Endpoint</Text>
              <TextInput
                className="h-11 bg-white border border-ink-200 rounded-xl px-4 text-sm text-black mb-2"
                placeholder="https://integrate.api.nvidia.com/v1"
                placeholderTextColor="#bbbbbb"
                value={nimEp}
                onChangeText={setNimEp}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={saveNimKey} className="bg-black h-9 px-5 rounded-xl items-center justify-center self-end">
                <Text className="text-white text-xs font-semibold">Save</Text>
              </TouchableOpacity>

              <View className="h-px bg-ink-100 my-4" />

              <Text className="text-xs font-semibold text-ink-400 mb-2">Local GGUF Model Path</Text>
              <TextInput
                className="h-11 bg-white border border-ink-200 rounded-xl px-4 text-sm text-black mb-2"
                placeholder="/path/to/model.gguf"
                placeholderTextColor="#bbbbbb"
                value={ggufPath}
                onChangeText={setGgufPath}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={saveModelPath} className="bg-black h-9 px-5 rounded-xl items-center justify-center self-end">
                <Text className="text-white text-xs font-semibold">Save</Text>
              </TouchableOpacity>
            </Card>
          )}

          <SectionHeader title="Notifications" />
          <Card className="mb-4 p-0 overflow-hidden">
            <MenuRow
              icon="bell"
              label="Notification Listener"
              subtitle={notifEnabled ? "Service active" : "Tap to enable"}
              onPress={openSettings}
              right={
                <View className={`w-2.5 h-2.5 rounded-full ${notifEnabled ? "bg-green-500" : "bg-ink-300"}`} />
              }
            />
            <MenuRow
              icon="volume-2"
              label="Foreground Service"
              subtitle="Listen to notifications in background"
            />
          </Card>

          <SectionHeader title="Storage" />
          <TouchableOpacity onPress={() => setShowStorage(!showStorage)} activeOpacity={0.7}>
            <Card className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center">
                  <Feather name="hard-drive" size={16} color="#000000" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-black">Data Storage</Text>
                  <Text className="text-xs text-ink-400 mt-0.5">Manage cached data per category</Text>
                </View>
              </View>
              <Feather name={showStorage ? "chevron-up" : "chevron-down"} size={18} color="#bbbbbb" />
            </Card>
          </TouchableOpacity>

          {showStorage && (
            <Card className="mb-4 p-0 overflow-hidden">
              {storageCategories.map(({ label, key, storage, icon }) => (
                <View key={key} className="flex-row items-center gap-3 py-3 px-4 border-b border-ink-100 last:border-b-0">
                  <View className="w-8 h-8 bg-ink-100 rounded-lg items-center justify-center">
                    <Feather name={icon} size={12} color="#666666" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-black">{label}</Text>
                    <Text className="text-xs text-ink-300">{sizes[key] ?? 0} items</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmClear(label, () => storage.clearAll())}
                    className="px-3 py-1.5 rounded-lg bg-ink-100"
                  >
                    <Text className="text-xs text-ink-500 font-medium">Clear</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          )}

          <Button
            title="Factory Reset — Delete All"
            variant="destructive"
            onPress={confirmFactoryReset}
            icon={<Feather name="alert-triangle" size={14} color="#ffffff" />}
            className="mb-8"
          />

          <SectionHeader title="Auto-Cleanup" />
          <Card className="mb-4 p-0 overflow-hidden">
            {([
              { label: "Notifications", key: "notificationsDays" as const },
              { label: "Email Cache", key: "emailsDays" as const },
              { label: "Chat Messages", key: "chatDays" as const },
              { label: "OCR Images", key: "ocrDays" as const },
            ]).map(({ label, key }) => (
              <View key={key} className="flex-row items-center justify-between py-3 px-4 border-b border-ink-100 last:border-b-0">
                <Text className="text-sm text-black">{label}</Text>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => setCleanupPolicies({ [key]: Math.max(1, cleanupPolicies[key] - 1) })}
                    className="w-7 h-7 bg-ink-100 rounded-lg items-center justify-center"
                  >
                    <Feather name="minus" size={12} color="#666666" />
                  </TouchableOpacity>
                  <Text className="text-sm font-semibold text-black w-7 text-center">
                    {cleanupPolicies[key]}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setCleanupPolicies({ [key]: Math.min(365, cleanupPolicies[key] + 1) })}
                    className="w-7 h-7 bg-ink-100 rounded-lg items-center justify-center"
                  >
                    <Feather name="plus" size={12} color="#666666" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Card>

          <SectionHeader title="About" />
          <Card>
            <View className="flex-row items-center gap-4">
              <Logo size={44} />
              <View className="flex-1">
                <Text className="text-lg font-semibold text-black">Seishin</Text>
                <Text className="text-xs text-ink-400">v1.0.0</Text>
                <Text className="text-xs text-ink-300 mt-1">Serverless life manager</Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

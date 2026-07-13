import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, ActivityIndicator } from "react-native";

import { router } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import * as DocumentPicker from "expo-document-picker";
import { useSettingsStore } from "@/stores/settings-store";
import {
  getStorageSizes, clearAllStorage,
  eventsStorage, messagesStorage, emailsStorage,
  notificationsStorage, agentStorage, ocrStorage, todosStorage, invitesStorage,
} from "@/stores/mmkv";
import { clearOcrHistory } from "@/services/ocr";
import { useNotifications } from "@/services/notification-service";
import * as FileSystem from "expo-file-system";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SheetModal } from "@/components/ui/SheetModal";
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
      <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
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
  const { loadSettings, cleanupPolicies, setCleanupPolicies, apiKeys, setApiKey, nimEndpoint, setNimEndpoint, nimModel, setNimModel, modelPath, setModelPath } = useSettingsStore();
  const { isGranted, openSettings } = useNotifications();
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [nimKey, setNimKey] = useState("");
  const [nimEp, setNimEp] = useState("");
  const [nimMd, setNimMd] = useState("");
  const [ggufPath, setGgufPath] = useState("");
  const [showStorage, setShowStorage] = useState(false);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);


  const [showModelPicker, setShowModelPicker] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  const [ggufFileName, setGgufFileName] = useState("");
  const [modalConfig, setModalConfig] = useState<{ title: string; message: string } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    loadSettings();
    setSizes(getStorageSizes());
    isGranted().then(setNotifEnabled);
  }, []);

  useEffect(() => {
    setNimKey(apiKeys.nim);
    setNimEp(nimEndpoint);
    setNimMd(nimModel);
    setGgufPath(modelPath || "");
    if (modelPath) {
      const parts = modelPath.split("/");
      setGgufFileName(parts[parts.length - 1] || "");
    }
  }, [apiKeys.nim, nimEndpoint, nimModel, modelPath]);

  function confirmClear(title: string, onClear: () => void) {
    setConfirmConfig({
      title: "Clear " + title,
      message: "This action cannot be undone.",
      onConfirm: () => { onClear(); setSizes(getStorageSizes()); },
    });
  }

  function confirmFactoryReset() {
    setConfirmConfig({
      title: "Factory Reset",
      message: "This will delete ALL data. Are you sure?",
      onConfirm: () => {
        clearAllStorage();
        clearOcrHistory();
        setSizes(getStorageSizes());
        setModalConfig({ title: "Done", message: "All data has been cleared." });
      },
    });
  }

  function saveNimConfig() {
    setApiKey("nim", nimKey);
    setNimEndpoint(nimEp);
    setNimModel(nimMd);
    setModalConfig({ title: "Saved", message: "NVIDIA NIM config updated. Switch to NIM mode in the Agent tab." });
  }

  const [ggufCopying, setGgufCopying] = useState(false);
  const [ggufCopyProgress, setGgufCopyProgress] = useState("");

  async function saveModelPath() {
    if (!ggufPath) {
      setModelPath(null);
      setModalConfig({ title: "Saved", message: "Model path cleared." });
      return;
    }
    setGgufCopying(true);
    setGgufCopyProgress("Copying model file…");
    try {
      const docsDir = FileSystem.documentDirectory || "/";
      const modelDir = `${docsDir}Models/`;
      await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });
      const fileName = ggufFileName || `model-${Date.now()}.gguf`;
      const dest = `${modelDir}${fileName}`;
      await FileSystem.copyAsync({ from: ggufPath, to: dest });
      setModelPath(dest);
      setGgufPath(dest);
      setModalConfig({ title: "Saved", message: `Model copied and ready. (${ggufFileName})` });
    } catch (e: any) {
      setModalConfig({ title: "Copy Failed", message: e.message || "Could not copy the model file. Try picking from a different location." });
    } finally {
      setGgufCopying(false);
      setGgufCopyProgress("");
    }
  }

  async function openModelPicker() {
    setShowModelPicker(true);
    if (models.length > 0) return;
    setLoadingModels(true);
    try {
      const baseUrl = (nimEp || "https://integrate.api.nvidia.com/v1").trim().replace(/\/+$/, "");
      const key = nimKey || apiKeys.nim;
      const res = await expoFetch(`${baseUrl}/models`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as Record<string, unknown>;
      const modelIds: string[] = ((data.data || data.models || []) as Array<{ id?: string; model?: string }>)
        .map((m) => m.id || m.model)
        .filter(Boolean) as string[];
      setModels(modelIds.sort());
    } catch (e) {
      setModalConfig({ title: "Could not load models", message: `Check your API key and endpoint, then try again.` });
    } finally {
      setLoadingModels(false);
    }
  }

  const [ggufPicking, setGgufPicking] = useState(false);

  async function pickGgufFile() {
    try {
      setGgufPicking(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: false,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        setGgufPath(asset.uri);
        setGgufFileName(asset.name || "");
      }
    } catch (e) {
      setModalConfig({ title: "Could not browse files", message: "The file picker did not respond. Try again." });
    } finally {
      setGgufPicking(false);
    }
  }

  const filteredModels = models.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pb-12">
          <View className="flex-row items-center gap-3 mb-6 pt-3">
            <Logo size={32} />
            <View>
              <Text className="text-2xl font-semibold tracking-tightest text-black">Settings</Text>
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
            <Card variant="elevated" className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
                  <Feather name="cpu" size={16} color="#000000" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-black">AI Provider</Text>
                  <Text className="text-xs text-ink-400 mt-0.5">
                    {apiKeys.nim ? "NVIDIA NIM ready" : "No key set"}
                    {modelPath ? " · GGUF set" : ""}
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
                className="h-11 bg-white border border-ink-200 rounded-lg px-4 text-sm text-black mb-2"
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
                className="h-11 bg-white border border-ink-200 rounded-lg px-4 text-sm text-black mb-2"
                placeholder="https://integrate.api.nvidia.com/v1"
                placeholderTextColor="#bbbbbb"
                value={nimEp}
                onChangeText={setNimEp}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text className="text-xs font-semibold text-ink-400 mb-2 mt-3">Model</Text>
              <TouchableOpacity
                onPress={openModelPicker}
                className="h-11 bg-white border border-ink-200 rounded-lg px-4 flex-row items-center justify-between mb-2"
              >
                <Text className={`text-sm flex-1 ${nimMd ? "text-black" : "text-ink-300"}`}>
                  {nimMd || "Select a model..."}
                </Text>
                <Feather name="chevron-down" size={16} color="#bbbbbb" />
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNimConfig} className="bg-black h-9 px-5 rounded-lg items-center justify-center self-end">
                <Text className="text-white text-sm font-semibold">Save</Text>
              </TouchableOpacity>

              <View className="h-px bg-ink-100 my-4" />

              <Text className="text-xs font-semibold text-ink-400 mb-2">Local GGUF Model</Text>
              <TouchableOpacity
                onPress={pickGgufFile}
                disabled={ggufPicking}
                className="h-11 bg-white border border-ink-200 rounded-lg px-4 flex-row items-center gap-3 mb-2"
              >
                {ggufPicking ? (
                  <ActivityIndicator size="small" color="#999999" />
                ) : (
                  <Feather name="folder" size={16} color="#999999" />
                )}
                <Text className={`text-sm flex-1 ${ggufFileName ? "text-black" : "text-ink-300"}`}>
                  {ggufFileName || (ggufPicking ? "Reading large file…" : "Tap to select a .gguf file")}
                </Text>
                {ggufFileName && (
                  <TouchableOpacity onPress={() => { setGgufPath(""); setGgufFileName(""); }}>
                    <Feather name="x-circle" size={14} color="#cccccc" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              <View className="flex-row items-center gap-2 self-end">
                {ggufCopying && (
                  <Text className="text-xs text-ink-400">{ggufCopyProgress}</Text>
                )}
                <TouchableOpacity onPress={saveModelPath} disabled={ggufCopying || !ggufPath} className="bg-black h-9 px-5 rounded-lg items-center justify-center min-w-[60px]">
                  {ggufCopying ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white text-sm font-semibold">Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          )}

          <SectionHeader title="Music Download" />
          <Card className="mb-4">
            <View className="bg-ink-50 rounded-lg p-3">
              <Text className="text-xs text-ink-500">
                Search any song or paste a YouTube URL/playlist. Downloads full audio, cover art (per track), and lyrics — all from YouTube, no API keys needed.
              </Text>
            </View>
          </Card>

          <SectionHeader title="Notifications" />
          <Card className="mb-4 p-0 overflow-hidden">
            <MenuRow
              icon="bell"
              label="Notification Listener"
              subtitle={notifEnabled ? "Service active" : "Tap to enable"}
              onPress={openSettings}
              right={
                <View className={`w-2.5 h-2.5 rounded-full ${notifEnabled ? "bg-success" : "bg-ink-300"}`} />
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
            <Card variant="elevated" className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
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
          <Card className="mb-4">
            <Text className="text-xs text-ink-500 mb-2">Auto-delete items older than the set number of days.</Text>
          </Card>
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
                  <Text className="text-xs text-ink-400 w-9">days</Text>
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
          <Card variant="elevated">
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

      <Modal visible={showModelPicker} transparent animationType="slide" onRequestClose={() => setShowModelPicker(false)}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-sheet max-h-[70%] min-h-[50%] px-5 pt-3 pb-10 shadow-float">
            <View className="w-10 h-1 bg-ink-200 rounded-full self-center mb-5" />
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold tracking-tightest text-black">Select Model</Text>
              <TouchableOpacity onPress={() => setShowModelPicker(false)} className="w-8 h-8 bg-ink-100 rounded-full items-center justify-center">
                <Feather name="x" size={16} color="#666666" />
              </TouchableOpacity>
            </View>
            <TextInput
              className="h-12 bg-ink-50 rounded-xl px-4 text-sm text-black mb-4"
              placeholder="Search models..."
              placeholderTextColor="#999999"
              value={modelSearch}
              onChangeText={setModelSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {loadingModels ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="small" color="#000000" />
                <Text className="text-sm text-ink-400 mt-3">Loading models...</Text>
              </View>
            ) : filteredModels.length === 0 ? (
              <View className="flex-1 items-center justify-center">
                <Feather name="search" size={24} color="#cccccc" />
                <Text className="text-sm text-ink-300 mt-2">{models.length === 0 ? "No models found" : "No matches"}</Text>
              </View>
            ) : (
              <FlatList
                data={filteredModels}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setNimMd(item); setShowModelPicker(false); setModelSearch(""); }}
                    className={`flex-row items-center gap-3 py-3 px-3 rounded-lg mb-1 ${
                      item === nimMd ? "bg-black" : "bg-ink-100"
                    }`}
                  >
                    <Feather name="cpu" size={14} color={item === nimMd ? "#ffffff" : "#999999"} />
                    <Text className={`text-sm flex-1 ${item === nimMd ? "text-white font-medium" : "text-black"}`} numberOfLines={1}>
                      {item}
                    </Text>
                    {item === nimMd && (
                      <Feather name="check" size={14} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
      <SheetModal
        visible={modalConfig !== null}
        onClose={() => setModalConfig(null)}
        title={modalConfig?.title}
        message={modalConfig?.message}
      />
      <SheetModal
        visible={confirmConfig !== null}
        onClose={() => setConfirmConfig(null)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmLabel="Clear"
        confirmDestructive
        onConfirm={() => { confirmConfig?.onConfirm(); setConfirmConfig(null); }}
      />
    </View>
  );
}

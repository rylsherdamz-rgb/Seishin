import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from "react-native";
import BottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";

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
import * as FileSystem from "expo-file-system/legacy";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SheetModal } from "@/components/ui/SheetModal";
import { Logo } from "@/components/Logo";
import Feather from "@expo/vector-icons/Feather";
import { fetchNimModels, cacheNimModels, categorizeModel, getTierLabel } from "@/services/nim-models";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function SettingsScreen() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const cleanupPolicies = useSettingsStore((s) => s.cleanupPolicies);
  const setCleanupPolicies = useSettingsStore((s) => s.setCleanupPolicies);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const nimEndpoint = useSettingsStore((s) => s.nimEndpoint);
  const setNimEndpoint = useSettingsStore((s) => s.setNimEndpoint);
  const nimModel = useSettingsStore((s) => s.nimModel);
  const setNimModel = useSettingsStore((s) => s.setNimModel);
  const modelPath = useSettingsStore((s) => s.modelPath);
  const setModelPath = useSettingsStore((s) => s.setModelPath);
  const darkMode = useSettingsStore((s) => s.darkMode);
  const setDarkMode = useSettingsStore((s) => s.setDarkMode);
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
  const modelSheetRef = useRef<BottomSheet>(null);
  const modelSnapPoints = useMemo(() => ["40%", "70%"], []);

  const [ggufFileName, setGgufFileName] = useState("");
  const [ggufCopying, setGgufCopying] = useState(false);
  const [ggufCopyProgress, setGgufCopyProgress] = useState("");
  const [ggufFileSize, setGgufFileSize] = useState(0);
  const [ggufPicking, setGgufPicking] = useState(false);
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

  const confirmClear = useCallback((title: string, onClear: () => void) => {
    setConfirmConfig({
      title: "Clear " + title,
      message: "This action cannot be undone.",
      onConfirm: () => { onClear(); setSizes(getStorageSizes()); },
    });
  }, [setConfirmConfig, setSizes]);

  const confirmFactoryReset = useCallback(() => {
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
  }, [setConfirmConfig, setModalConfig, setSizes]);

  const saveNimConfig = useCallback(async () => {
    setApiKey("nim", nimKey);
    setNimEndpoint(nimEp);
    setNimModel(nimMd);

    // Auto-detect available models when a key is provided
    if (nimKey) {
      try {
        const result = await fetchNimModels(nimEp || "https://integrate.api.nvidia.com/v1", nimKey);
        cacheNimModels(result.models);
        setModels(result.models);
        if (result.largeModel && !nimMd.includes("70b") && !nimMd.includes("nemotron")) {
          setNimMd(result.recommended);
        }
      } catch {
        // Non-blocking — user can still use their configured model
      }
    }

    setModalConfig({ title: "Saved", message: "NVIDIA NIM config updated. Switch to NIM mode in the Agent tab." });
  }, [nimKey, nimEp, nimMd, setApiKey, setNimEndpoint, setNimModel, setModalConfig]);

  const saveModelPath = useCallback(async () => {
    if (!ggufPath) {
      setModelPath(null);
      setModalConfig({ title: "Saved", message: "Model path cleared." });
      return;
    }
    setGgufCopying(true);
    setGgufCopyProgress("Copying model file…");
    try {
      const docsDir = FileSystem.documentDirectory || "";
      const modelDir = `${docsDir}Models/`;
      const fileName = ggufFileName || `model-${Date.now()}.gguf`;
      const dest = `${modelDir}${fileName}`;
      await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true });
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
  }, [ggufPath, ggufFileName, setModelPath, setGgufPath, setModalConfig, setGgufCopying, setGgufCopyProgress]);

  const pickGgufFile = useCallback(async () => {
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
        setGgufFileSize(asset.size ?? 0);
      }
    } catch (e) {
      setModalConfig({ title: "Could not browse files", message: "The file picker did not respond. Try again." });
    } finally {
      setGgufPicking(false);
    }
  }, [setGgufPicking, setGgufPath, setGgufFileName, setGgufFileSize, setModalConfig]);

  const openModelPicker = useCallback(async () => {
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
  }, [models, nimEp, nimKey, apiKeys, setShowModelPicker, setLoadingModels, setModels, setModalConfig]);

  const filteredModels = useMemo(() => models.filter((m) => m.toLowerCase().includes(modelSearch.toLowerCase())), [models, modelSearch]);

  const renderModelItem = useCallback(({ item }: { item: string }) => {
    const info = categorizeModel(item);
    return (
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
        <View className={`px-2 py-0.5 rounded-full bg-${
          info.tier === "fast" ? "green-100" : info.tier === "balanced" ? "yellow-100" : info.tier === "smart" ? "red-100" : "ink-100"
        }`}>
          <Text className={`text-[10px] font-medium text-${
            info.tier === "fast" ? "green-700" : info.tier === "balanced" ? "yellow-700" : info.tier === "smart" ? "red-700" : "ink-500"
          }`}>
            {getTierLabel(info.tier)}
          </Text>
        </View>
        {item === nimMd && (
          <Feather name="check" size={14} color="#ffffff" />
        )}
      </TouchableOpacity>
    );
  }, [nimMd, setNimMd, setShowModelPicker, setModelSearch]);

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

          <SectionHeader title="Appearance" />
          <Card className="mb-4 p-0 overflow-hidden">
            <TouchableOpacity
              onPress={() => setDarkMode(!darkMode)}
              className="flex-row items-center gap-3 py-3.5 px-4 border-b border-ink-100"
            >
              <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
                <Feather name={darkMode ? "moon" : "sun"} size={14} color="#000000" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-black">Dark Mode</Text>
              </View>
              <View className={`w-11 h-6 rounded-full items-center ${darkMode ? "bg-black" : "bg-ink-300"} justify-center`}>
                <View className={`w-5 h-5 rounded-full bg-white ${darkMode ? "self-end mr-0.5" : "self-start ml-0.5"}`} />
              </View>
            </TouchableOpacity>
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
                <Text className={`text-sm flex-1 ${nimMd ? "text-black" : "text-ink-300"}`} numberOfLines={1}>
                  {nimMd || "Select a model..."}
                </Text>
                {nimMd && (
                  <View className={`px-2 py-0.5 rounded-full mr-2 ${
                    categorizeModel(nimMd).tier === "fast" ? "bg-green-100" :
                    categorizeModel(nimMd).tier === "balanced" ? "bg-yellow-100" :
                    categorizeModel(nimMd).tier === "smart" ? "bg-red-100" : "bg-ink-100"
                  }`}>
                    <Text className={`text-[10px] font-medium ${
                      categorizeModel(nimMd).tier === "fast" ? "text-green-700" :
                      categorizeModel(nimMd).tier === "balanced" ? "text-yellow-700" :
                      categorizeModel(nimMd).tier === "smart" ? "text-red-700" : "text-ink-500"
                    }`}>
                      {getTierLabel(categorizeModel(nimMd).tier)}
                    </Text>
                  </View>
                )}
                <Feather name="chevron-down" size={16} color="#bbbbbb" />
              </TouchableOpacity>
              <Text className="text-xs font-semibold text-ink-400 mb-2 mt-3">Quick Models</Text>
              <ScrollView horizontal className="mb-2" showsHorizontalScrollIndicator={false}>
                {[
                  { id: "meta/llama-3.2-1b-instruct", label: "Llama 1B", desc: "Fastest" },
                  { id: "meta/llama-3.2-3b-instruct", label: "Llama 3B", desc: "Balanced" },
                  { id: "mistralai/mistral-7b-instruct-v0.3", label: "Mistral 7B", desc: "Smart" },
                  { id: "nvidia/llama-3.1-nemotron-70b-instruct", label: "Nemotron 70B", desc: "Best" },
                ].map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setNimMd(m.id)}
                    className={`px-3 py-2 mr-2 rounded-xl border ${
                      nimMd === m.id ? "bg-black border-black" : "bg-white border-ink-200"
                    }`}
                  >
                    <Text className={`text-xs font-medium ${nimMd === m.id ? "text-white" : "text-black"}`}>{m.label}</Text>
                    <Text className={`text-[10px] mt-0.5 ${nimMd === m.id ? "text-white/70" : "text-ink-400"}`}>{m.desc}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

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
              {ggufCopying && (
                <View className="bg-ink-50 rounded-lg p-3 mb-2">
                  <View className="flex-row items-center gap-2 mb-2">
                    <ActivityIndicator size="small" color="#666666" />
                    <Text className="text-xs text-ink-600 flex-1">
                      Copying{ggufFileSize > 0 ? ` ${formatBytes(ggufFileSize)}` : ""}…
                    </Text>
                  </View>
                  <View className="w-full bg-ink-200 rounded-full h-1.5 overflow-hidden">
                    <View className="bg-black h-full rounded-full" style={{ width: "30%" }} />
                  </View>
                  <Text className="text-xs text-ink-400 mt-2">
                    You can continue browsing Settings while this runs in the background.
                  </Text>
                </View>
              )}
              <TouchableOpacity onPress={saveModelPath} disabled={ggufCopying || !ggufPath} className="bg-black h-9 px-5 rounded-lg items-center justify-center self-end">
                <Text className="text-white text-sm font-semibold">Save</Text>
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

        <BottomSheet
          ref={modelSheetRef}
          snapPoints={modelSnapPoints}
          enablePanDownToClose
          index={showModelPicker ? 0 : -1}
          backgroundStyle={{ backgroundColor: "#ffffff" }}
          onChange={(index: number) => { if (index === -1) setShowModelPicker(false); }}
        >
          <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 0, paddingBottom: 40 }}>
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
                removeClippedSubviews
                maxToRenderPerBatch={20}
                windowSize={10}
                renderItem={renderModelItem}
              />
            )}
          </BottomSheetView>
        </BottomSheet>
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

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, ActivityIndicator,
} from "react-native";
import BottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import Animated, { FadeInDown, useAnimatedStyle, withRepeat, withTiming, withSequence, useSharedValue } from "react-native-reanimated";

import { router } from "expo-router";
import { launchCameraAsync, launchImageLibraryAsync } from "expo-image-picker";
import { getDocumentAsync } from "expo-document-picker";
import { useAgentStore, AgentMessage, AgentAttachment } from "@/stores/agent-store";
import { useSettingsStore } from "@/stores/settings-store";
import { runAgentLoop, stopAgentLoop } from "@/services/agent-engine";
import { useKeyboardPadding } from "@/hooks/useKeyboardPadding";
import { recognizeText } from "@/services/ocr";
import { uid } from "@/utils/id";
import { categorizeModel, getTierLabel } from "@/services/nim-models";
import * as Clipboard from "expo-clipboard";
import { MessageBubble } from "@/components/agent/MessageBubble";
import { AlertDialog } from "@/components/ui/AlertDialog";
import Feather from "@expo/vector-icons/Feather";
import { Photo } from "@/components/ui/Photo";
import {
  onModelStateChange, getModelState, loadModel, unloadModel, isModelLoaded,
} from "@/services/local-llama";
import { useColors } from "@/theme/ThemeProvider";

// Static class names: NativeWind only generates classes it can see verbatim,
// so tier colors can't be assembled with template strings.
const TIER_STYLE: Record<string, { bg: string; text: string }> = {
  fast: { bg: "bg-green-100", text: "text-green-700" },
  balanced: { bg: "bg-yellow-100", text: "text-yellow-700" },
  smart: { bg: "bg-red-100", text: "text-red-700" },
};

const SUGGESTIONS = [
  { icon: "list" as const, label: "Plan my day", action: "What's on my calendar today?" },
  { icon: "calendar" as const, label: "Add an event", action: "Schedule a meeting tomorrow at 3pm" },
  { icon: "check-square" as const, label: "Add a task", action: "Add a task to buy groceries" },
  { icon: "file-text" as const, label: "New note", action: "Save a note about my project ideas" },
];

function ThinkingIndicator() {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    dot1.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1);
    setTimeout(() => dot2.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1), 200);
    setTimeout(() => dot3.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })), -1), 400);
  }, []);

  const s1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View className="flex-row items-center gap-1.5 px-4 py-3">
      <Animated.View style={s1} className="w-2 h-2 rounded-full bg-ink-300" />
      <Animated.View style={s2} className="w-2 h-2 rounded-full bg-ink-300" />
      <Animated.View style={s3} className="w-2 h-2 rounded-full bg-ink-300" />
    </View>
  );
}

export default function AgentScreen() {
  const T = useColors();
  const messages = useAgentStore((s) => s.messages);
  const currentProvider = useAgentStore((s) => s.currentProvider);
  const isProcessing = useAgentStore((s) => s.isProcessing);
  const load = useAgentStore((s) => s.load);
  const setProvider = useAgentStore((s) => s.setProvider);
  const clearConversation = useAgentStore((s) => s.clearConversation);
  const modelState = useAgentStore((s) => s.modelState);
  const modelProgress = useAgentStore((s) => s.modelProgress);
  const modelError = useAgentStore((s) => s.modelError);
  const setModelState = useAgentStore((s) => s.setModelState);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const nimModel = useSettingsStore((s) => s.nimModel);
  const nimLargeModel = useSettingsStore((s) => s.nimLargeModel);
  const nimEndpoint = useSettingsStore((s) => s.nimEndpoint);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const modelPath = useSettingsStore((s) => s.modelPath);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<AgentAttachment[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const keyboardPadding = useKeyboardPadding();
  const pickerSnapPoints = useMemo(() => ["35%"], []);
  const flatListRef = useRef<FlatList>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    load();
    loadSettings();
    const unsub = onModelStateChange(() => {
      const s = getModelState();
      setModelState(s.state, s.progress, s.error);
    });
    return () => { unsub(); };
  }, []);

  useEffect(() => {
    if (currentProvider === "local" && modelPath && !isModelLoaded() && !loadingRef.current) {
      loadingRef.current = true;
      loadModel(modelPath).catch(() => { }).finally(() => { loadingRef.current = false; });
    }
    if (currentProvider === "nim" && isModelLoaded()) {
      unloadModel().catch(() => { });
    }
  }, [currentProvider, modelPath]);

  useEffect(() => {
    if (apiKeys.nim && currentProvider === "local") {
      setProvider("nim");
    }
  }, [apiKeys.nim]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput("");
    const attachments = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    setPendingAttachments([]);

    let extractedContext: string | undefined;
    if (attachments) {
      const texts: string[] = [];
      for (const att of attachments) {
        if (att.type === "image") {
          try {
            const t = await recognizeText(att.uri);
            if (t.trim()) texts.push(`[Image: ${att.name || "photo"}]\n${t.trim()}`);
          } catch {
            // OCR is best-effort
          }
        } else {
          texts.push(`[File attached: ${att.name || "file"}]`);
        }
      }
      if (texts.length > 0) extractedContext = texts.join("\n\n");
    }

    await runAgentLoop(text, { attachments, extractedContext });
  }, [input, isProcessing, pendingAttachments]);

  const showAttachmentPicker = useCallback(() => {
    setShowPicker(true);
  }, []);

  const addPhoto = useCallback(async (fromCamera: boolean) => {
    const picker = fromCamera ? launchCameraAsync : launchImageLibraryAsync;
    const result = await picker({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingAttachments((prev) => [
      ...prev,
      { type: "image", uri: asset.uri, name: asset.fileName ?? undefined, mimeType: asset.mimeType ?? "image/*" },
    ]);
  }, []);

  const addFile = useCallback(async () => {
    const result = await getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPendingAttachments((prev) => [
      ...prev,
      { type: "file", uri: asset.uri, name: asset.name ?? undefined, mimeType: asset.mimeType ?? undefined },
    ]);
  }, []);

  const removePendingAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: AgentMessage }) => (
      <MessageBubble item={item} copied={copiedId === item.id} onCopy={copyToClipboard} />
    ),
    [copiedId, copyToClipboard],
  );

  const hasKey = !!apiKeys.nim;

  return (
    <View className="flex-1 bg-white" style={{ paddingBottom: keyboardPadding - 75 }}>
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-[30px] font-extrabold tracking-tightest text-black">AI Agent</Text>
            <Text className="text-sm text-ink-500 mt-0.5">
              {currentProvider === "nim"
                ? `NVIDIA NIM${nimLargeModel ? ` · auto-routes ${getTierLabel(categorizeModel(nimModel).tier)}→${getTierLabel(categorizeModel(nimLargeModel).tier)}` : ""}`
                : modelState === "loading"
                  ? "Loading model..."
                  : modelState === "ready"
                    ? "Local (offline) · Ready"
                    : modelState === "error"
                      ? "Local · Error"
                      : "Local (offline)"}
              {isProcessing && " · Thinking..."}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              className="w-11 h-11 bg-ink-50 rounded-full items-center justify-center"
            >
              <Feather name="settings" size={14} color={T.ink500} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowClearConfirm(true)}
              className="w-11 h-11 bg-ink-50 rounded-full items-center justify-center"
            >
              <Feather name="trash-2" size={14} color={T.ink500} />
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row gap-2 items-center">
          {(["local", "nim"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setProvider(p)}
              disabled={p === "nim" && !hasKey}
              className={`px-3 py-1.5 rounded-full ${currentProvider === p ? "bg-black" : "bg-ink-100"
                } ${p === "nim" && !hasKey ? "opacity-40" : ""}`}
            >
              <Text className={`text-xs font-medium ${currentProvider === p ? "text-white" : "text-ink-500"
                }`}>
                {p === "nim" ? "NVIDIA NIM" : "Local GGUF"}
              </Text>
            </TouchableOpacity>
          ))}
          {currentProvider === "nim" && (
            <TouchableOpacity
              key="nim-model-pill"
              onPress={() => router.push("/settings")}
              className="px-2.5 py-1 rounded-full bg-ink-100 flex-row items-center gap-1.5"
            >
              <Text className="text-xs text-ink-500 font-mono" numberOfLines={1}>
                {nimModel.split("/").pop() || "model"}
              </Text>
              <View className={`px-1.5 py-0.5 rounded-full ${TIER_STYLE[categorizeModel(nimModel).tier]?.bg ?? "bg-ink-200"}`}>
                <Text className={`text-[9px] font-semibold ${TIER_STYLE[categorizeModel(nimModel).tier]?.text ?? "text-ink-500"}`}>
                  {getTierLabel(categorizeModel(nimModel).tier)}
                </Text>
              </View>
            </TouchableOpacity>
          )}

        </View>
      </View>

      {!hasKey && currentProvider === "nim" && (
        <View key="agent-nim-nokey-banner" className="mx-4 mb-3 bg-danger-soft rounded-xl p-3 flex-row items-center gap-2">
          <Feather name="alert-circle" size={14} color={T.danger} />
          <Text className="text-xs text-danger flex-1">No NIM API key set. Go to Settings to add one.</Text>
        </View>
      )}
      {currentProvider === "local" && modelState === "loading" && (
        <View key="agent-local-loading" className="mx-4 mb-3 bg-ink-100 rounded-xl p-3">
          <View className="flex-row items-center gap-2 mb-2">
            <ActivityIndicator size="small" color={T.ink500} />
            <Text className="text-xs text-ink-600 flex-1">Loading local model... {modelProgress}%</Text>
          </View>
          <View className="h-1.5 bg-ink-200 rounded-full overflow-hidden">
            <View className="h-full bg-black rounded-full" style={{ width: `${modelProgress}%` }} />
          </View>
        </View>
      )}
      {currentProvider === "local" && modelState === "ready" && (
        <View key="agent-local-ready" className="mx-4 mb-3 bg-green-50 rounded-xl p-3 flex-row items-center gap-2">
          <Feather name="check-circle" size={14} color="#22c55e" />
          <Text className="text-xs text-green-700 flex-1">Local model ready</Text>
        </View>
      )}
      {currentProvider === "local" && modelState === "error" && (
        <View key="agent-local-error" className="mx-4 mb-3 bg-danger-soft rounded-xl p-3">
          <View className="flex-row items-center gap-2 mb-1">
            <Feather name="alert-circle" size={14} color={T.danger} />
            <Text className="text-xs text-danger flex-1">Failed to load model</Text>
            <TouchableOpacity onPress={() => { if (modelPath) loadModel(modelPath).catch(() => { }); }}>
              <Text className="text-xs text-danger font-medium">Retry</Text>
            </TouchableOpacity>
          </View>
          {modelError && <Text className="text-xs text-danger/70 ml-6">{modelError}</Text>}
        </View>
      )}
      {currentProvider === "local" && modelState === "unloaded" && !modelPath && (
        <View key="agent-local-nopath" className="mx-4 mb-3 bg-ink-100 rounded-xl p-3 flex-row items-center gap-2">
          <Feather name="info" size={14} color={T.ink500} />
          <Text className="text-xs text-ink-600 flex-1">No GGUF model selected. Go to Settings to pick one.</Text>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-2"
        alwaysBounceVertical
        removeClippedSubviews
        maxToRenderPerBatch={15}
        windowSize={10}
        ListFooterComponent={isProcessing ? <ThinkingIndicator /> : null}
        renderItem={renderItem}
        ListEmptyComponent={
          <View className="items-center justify-center py-24 px-8">
            <View className="w-16 h-16 bg-ink-50 border border-ink-100 rounded-full items-center justify-center mb-4 shadow-subtle">
              <Feather name="cpu" size={24} color={T.ink200} />
            </View>
            <Text className="text-base font-medium text-ink-400 text-center">Ask me anything</Text>
            <Text className="text-sm text-ink-200 mt-1 text-center max-w-[260px]">
              {hasKey
                ? "I can manage your schedule, tasks, and more"
                : "Add an API key in Settings to use the AI agent"}
            </Text>
          </View>
        }
      />

      {pendingAttachments.length > 0 && (
        <ScrollView horizontal className="px-4 py-2 border-t border-ink-100 bg-white" showsHorizontalScrollIndicator={false}>
          {pendingAttachments.map((att, i) => (
            <View key={i} className="mr-2 relative">
              {att.type === "image" ? (
                <Photo uri={att.uri} width={64} height={64} radius={8} />
              ) : (
                <View className="w-16 h-16 rounded-lg bg-ink-100 items-center justify-center">
                  <Feather name="file" size={20} color={T.ink500} />
                </View>
              )}
              <TouchableOpacity
                onPress={() => removePendingAttachment(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger rounded-full items-center justify-center"
              >
                <Feather name="x" size={10} color={T.white} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      {!isProcessing && messages.length === 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-4 gap-2"
          className="grow-0 py-1.5"
          keyboardShouldPersistTaps="handled"
        >
          {SUGGESTIONS.map((sg) => (
            <TouchableOpacity
              key={sg.label}
              onPress={() => setInput(sg.action)}
              activeOpacity={0.7}
              accessibilityRole="button"
              className="flex-row items-center gap-1.5 h-10 px-3.5 rounded-full border border-ink-100"
            >
              <Feather name={sg.icon} size={13} color={T.accent} />
              <Text className="text-xs font-semibold text-black">{sg.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <View className="px-3 pt-2 pb-3 bg-white">
        <View className="flex-row items-center gap-1 min-h-[56px] rounded-[22px] bg-ink-50 pl-1.5 pr-1.5">
          <TouchableOpacity
            onPress={showAttachmentPicker}
            disabled={isProcessing}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Attach photo or file"
            className="w-11 h-11 items-center justify-center"
          >
            <Feather name="plus" size={20} color={isProcessing ? T.ink200 : T.ink500} />
          </TouchableOpacity>
          <TextInput
            className="flex-1 py-3 text-[15px] text-black"
            placeholder={isProcessing ? "Thinking…" : "Ask about your day…"}
            placeholderTextColor={T.ink400}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            editable={!isProcessing}
            multiline
            maxLength={4000}
            accessibilityLabel="Message"
          />
          {isProcessing ? (
            <TouchableOpacity
              onPress={stopAgentLoop}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Stop"
              className="h-11 w-11 items-center justify-center rounded-2xl bg-danger"
            >
              <View className="w-3.5 h-3.5 bg-white rounded-sm" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Send"
              className={`h-11 w-11 items-center justify-center rounded-2xl ${input.trim() ? "bg-accent" : "bg-ink-150"}`}
            >
              <Feather name="arrow-up" size={18} color={input.trim() ? T.onAccent : T.ink400} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <BottomSheet
        snapPoints={pickerSnapPoints}
        enableDynamicSizing
        enablePanDownToClose
        index={showPicker ? 0 : -1}
        backgroundStyle={{ backgroundColor: T.white }}
        onChange={(index: number) => { if (index === -1) setShowPicker(false); }}
      >
        <BottomSheetView style={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}>
          <TouchableOpacity
            className="flex-row items-center gap-3 py-3.5"
            onPress={() => { setShowPicker(false); addPhoto(true); }}
          >
            <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
              <Feather name="camera" size={16} color={T.black} />
            </View>
            <Text className="text-base text-black">Take Photo</Text>
          </TouchableOpacity>
          <View className="h-px bg-ink-100" />
          <TouchableOpacity
            className="flex-row items-center gap-3 py-3.5"
            onPress={() => { setShowPicker(false); addPhoto(false); }}
          >
            <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
              <Feather name="image" size={16} color={T.black} />
            </View>
            <Text className="text-base text-black">Choose from Library</Text>
          </TouchableOpacity>
          <View className="h-px bg-ink-100" />
          <TouchableOpacity
            className="flex-row items-center gap-3 py-3.5"
            onPress={() => { setShowPicker(false); addFile(); }}
          >
            <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
              <Feather name="file" size={14} color={T.black} />
            </View>
            <Text className="text-base text-black">Pick File</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
      <AlertDialog
        visible={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear conversation?"
        message="All messages will be deleted."
        confirmLabel="Clear All"
        confirmDestructive
        onConfirm={clearConversation}
      />
    </View>
  );
}

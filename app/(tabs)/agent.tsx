import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Image, ActivityIndicator,
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
import { Markdown } from "@/components/Markdown";
import { AlertDialog } from "@/components/ui/AlertDialog";
import Feather from "@expo/vector-icons/Feather";
import {
  onModelStateChange, getModelState, loadModel, unloadModel, isModelLoaded,
} from "@/services/local-llama";

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
  const messages = useAgentStore((s) => s.messages);
  const currentProvider = useAgentStore((s) => s.currentProvider);
  const isProcessing = useAgentStore((s) => s.isProcessing);
  const streamTick = useAgentStore((s) => s.streamTick);
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
      loadModel(modelPath).catch(() => {}).finally(() => { loadingRef.current = false; });
    }
    if (currentProvider === "nim" && isModelLoaded()) {
      unloadModel().catch(() => {});
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

  const renderItem = useCallback(({ item }: { item: AgentMessage }) => {
    const isUser = item.role === "user";
    if (!isUser && !item.content) return null;
    return (
      <View
        className={`flex-row mb-3 ${isUser ? "justify-end" : "justify-start"} items-end gap-2`}
      >
        {!isUser && (
          <View className="w-7 h-7 bg-ink-100 rounded-full items-center justify-center shrink-0">
            <Feather name="cpu" size={12} color="#000000" />
          </View>
        )}
        <View className={`max-w-[80%] px-4 py-3 ${
          isUser
            ? "bg-black rounded-2xl rounded-br-md"
            : item.role === "tool"
            ? "bg-ink-25 rounded-2xl rounded-bl-md border border-ink-150"
            : "bg-white rounded-2xl rounded-bl-md border border-ink-100"
        }`}>
          {item.toolName && (
            <View className="flex-row items-center gap-1 mb-1.5 pb-1.5 border-b border-ink-100">
              <View className="w-5 h-5 bg-ink-100 rounded items-center justify-center">
                <Feather name="terminal" size={8} color="#666666" />
              </View>
              <Text className="text-xs text-ink-500 font-mono flex-1">{item.toolName}</Text>
              <Feather name="check-circle" size={10} color="#2fbf71" />
            </View>
          )}
          {isUser ? (
            <Text className="text-sm leading-5 text-white">{item.content}</Text>
          ) : (
            <Markdown content={item.content} />
          )}
          {item.attachments && item.attachments.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5 mt-2">
              {item.attachments.map((att: AgentAttachment, i: number) =>
                att.type === "image" ? (
                  <Image key={i} source={{ uri: att.uri }} className="w-20 h-20 rounded-lg" />
                ) : (
                  <View key={i} className="flex-row items-center gap-1 bg-ink-100 rounded-lg px-2 py-1.5">
                    <Feather name="file" size={12} color="#666" />
                    <Text className="text-xs text-ink-500">{att.name || "File"}</Text>
                  </View>
                )
              )}
            </View>
          )}
          <View className="flex-row items-center justify-between mt-2">
            <Text className={`text-xs ${isUser ? "text-ink-200" : "text-ink-400"}`}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
            {!isUser && !!item.content && (
              <TouchableOpacity
                onPress={() => copyToClipboard(item.content, item.id)}
                activeOpacity={0.6}
                className="flex-row items-center gap-1 ml-3 py-0.5"
              >
                <Feather name={copiedId === item.id ? "check" : "copy"} size={12} color="#999999" />
                <Text className="text-xs text-ink-400">{copiedId === item.id ? "Copied" : "Copy"}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {isUser && (
          <View className="w-7 h-7 bg-black rounded-full items-center justify-center shrink-0">
            <Feather name="user" size={12} color="#ffffff" />
          </View>
        )}
      </View>
    );
  }, [copiedId, copyToClipboard, streamTick]);

  const hasKey = !!apiKeys.nim;

  return (
    <View className="flex-1 bg-white" style={{ paddingBottom: keyboardPadding }}>
        <View className="px-4 pt-3 pb-2">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-2xl font-semibold tracking-tightest text-black">AI Agent</Text>
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
                className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center"
              >
                <Feather name="settings" size={14} color="#666666" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowClearConfirm(true)}
                className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center"
              >
                <Feather name="trash-2" size={14} color="#666666" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row gap-2 items-center">
            {(["local", "nim"] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setProvider(p)}
                disabled={p === "nim" && !hasKey}
                className={`px-3 py-1.5 rounded-full ${
                  currentProvider === p ? "bg-black" : "bg-ink-100"
                } ${p === "nim" && !hasKey ? "opacity-40" : ""}`}
              >
                <Text className={`text-xs font-medium ${
                  currentProvider === p ? "text-white" : "text-ink-500"
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
                <View className={`px-1.5 py-0.5 rounded-full bg-${
                  categorizeModel(nimModel).tier === "fast" ? "green-100" :
                  categorizeModel(nimModel).tier === "balanced" ? "yellow-100" :
                  categorizeModel(nimModel).tier === "smart" ? "red-100" : "ink-200"
                }`}>
                  <Text className={`text-[9px] font-semibold ${
                    categorizeModel(nimModel).tier === "fast" ? "text-green-700" :
                    categorizeModel(nimModel).tier === "balanced" ? "text-yellow-700" :
                    categorizeModel(nimModel).tier === "smart" ? "text-red-700" : "text-ink-500"
                  }`}>
                    {getTierLabel(categorizeModel(nimModel).tier)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

          </View>
        </View>

        {!hasKey && currentProvider === "nim" && (
          <View key="agent-nim-nokey-banner" className="mx-4 mb-3 bg-danger-soft rounded-xl p-3 flex-row items-center gap-2">
            <Feather name="alert-circle" size={14} color="#ff3b30" />
            <Text className="text-xs text-danger flex-1">No NIM API key set. Go to Settings to add one.</Text>
          </View>
        )}
        {currentProvider === "local" && modelState === "loading" && (
          <View key="agent-local-loading" className="mx-4 mb-3 bg-ink-100 rounded-xl p-3">
            <View className="flex-row items-center gap-2 mb-2">
              <ActivityIndicator size="small" color="#666666" />
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
              <Feather name="alert-circle" size={14} color="#ff3b30" />
              <Text className="text-xs text-danger flex-1">Failed to load model</Text>
              <TouchableOpacity onPress={() => { if (modelPath) loadModel(modelPath).catch(() => {}); }}>
                <Text className="text-xs text-danger font-medium">Retry</Text>
              </TouchableOpacity>
            </View>
            {modelError && <Text className="text-xs text-danger/70 ml-6">{modelError}</Text>}
          </View>
        )}
        {currentProvider === "local" && modelState === "unloaded" && !modelPath && (
          <View key="agent-local-nopath" className="mx-4 mb-3 bg-ink-100 rounded-xl p-3 flex-row items-center gap-2">
            <Feather name="info" size={14} color="#666666" />
            <Text className="text-xs text-ink-600 flex-1">No GGUF model selected. Go to Settings to pick one.</Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          extraData={streamTick}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-2"
          removeClippedSubviews
          maxToRenderPerBatch={15}
          windowSize={10}
          ListFooterComponent={isProcessing ? <ThinkingIndicator /> : null}
          renderItem={renderItem}
          ListEmptyComponent={
            <View className="items-center justify-center py-24 px-8">
              <View className="w-16 h-16 bg-ink-50 border border-ink-100 rounded-full items-center justify-center mb-4 shadow-subtle">
                <Feather name="cpu" size={24} color="#cccccc" />
              </View>
              <Text className="text-base font-medium text-ink-400 text-center">Ask me anything</Text>
              <Text className="text-sm text-ink-200 mt-1 text-center max-w-[260px]">
                {hasKey
                  ? "I can manage your schedule, todos, and more"
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
                  <Image source={{ uri: att.uri }} className="w-16 h-16 rounded-lg" />
                ) : (
                  <View className="w-16 h-16 rounded-lg bg-ink-100 items-center justify-center">
                    <Feather name="file" size={20} color="#666" />
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => removePendingAttachment(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger rounded-full items-center justify-center"
                >
                  <Feather name="x" size={10} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
        {!isProcessing && messages.length === 0 && (
          <View className="flex-row gap-2 px-4 py-1.5 bg-white">
            {[
              { icon: "check-square" as const, label: "Todo", action: "Add a todo to buy groceries" },
              { icon: "calendar" as const, label: "Event", action: "Schedule a meeting tomorrow at 3pm" },
              { icon: "file-text" as const, label: "Note", action: "Save a note about my project ideas" },
              { icon: "list" as const, label: "Today", action: "What's on my calendar today?" },
            ].map((suggestion) => (
              <TouchableOpacity
                key={suggestion.label}
                onPress={() => setInput(suggestion.action)}
                className="px-2.5 py-0.5 bg-ink-50 rounded-md border border-ink-100"
              >
                <Text className="text-[11px] text-ink-600 font-medium">{suggestion.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View className="px-4 py-3 border-t border-ink-100 bg-white">
          <View className="flex-row gap-1 items-center">
            <TouchableOpacity
              onPress={showAttachmentPicker}
              disabled={isProcessing}
              activeOpacity={0.7}
              className="w-10 h-12 items-center justify-center"
            >
              <Feather name="paperclip" size={18} color={isProcessing ? "#ccc" : "#666"} />
            </TouchableOpacity>
            <TextInput
              className="flex-1 h-12 bg-ink-50 rounded-xl px-4 text-base text-black"
              placeholder={isProcessing ? "AI is thinking..." : "Type a message..."}
              placeholderTextColor="#999999"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              editable={!isProcessing}
            />
            {isProcessing ? (
              <TouchableOpacity
                onPress={stopAgentLoop}
                activeOpacity={0.7}
                className="h-12 w-12 items-center justify-center rounded-xl bg-danger"
              >
                <View className="w-4 h-4 bg-white rounded-sm" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim()}
                activeOpacity={0.7}
                className={`h-12 w-12 items-center justify-center rounded-xl ${
                  input.trim() ? "bg-black" : "bg-ink-300"
                }`}
              >
                <Feather name="arrow-up" size={18} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <BottomSheet
          snapPoints={pickerSnapPoints}
          enableDynamicSizing
          enablePanDownToClose
          index={showPicker ? 0 : -1}
          backgroundStyle={{ backgroundColor: "#ffffff" }}
          onChange={(index: number) => { if (index === -1) setShowPicker(false); }}
        >
          <BottomSheetView style={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}>
            <TouchableOpacity
              className="flex-row items-center gap-3 py-3.5"
              onPress={() => { setShowPicker(false); addPhoto(true); }}
            >
              <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
                <Feather name="camera" size={16} color="#000" />
              </View>
              <Text className="text-base text-black">Take Photo</Text>
            </TouchableOpacity>
            <View className="h-px bg-ink-100" />
            <TouchableOpacity
              className="flex-row items-center gap-3 py-3.5"
              onPress={() => { setShowPicker(false); addPhoto(false); }}
            >
              <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
                <Feather name="image" size={16} color="#000" />
              </View>
              <Text className="text-base text-black">Choose from Library</Text>
            </TouchableOpacity>
            <View className="h-px bg-ink-100" />
            <TouchableOpacity
              className="flex-row items-center gap-3 py-3.5"
              onPress={() => { setShowPicker(false); addFile(); }}
            >
              <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
                <Feather name="file" size={14} color="#000" />
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

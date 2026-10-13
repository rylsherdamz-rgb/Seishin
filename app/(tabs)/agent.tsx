import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
} from "react-native";
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
import * as Clipboard from "expo-clipboard";
import { MessageBubble } from "@/components/agent/MessageBubble";
import { AgentHeader } from "@/components/agent/AgentHeader";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { SheetModal } from "@/components/ui/SheetModal";
import Feather from "@expo/vector-icons/Feather";
import { Photo } from "@/components/ui/Photo";
import {
  onModelStateChange, getModelState, loadModel, unloadModel, isModelLoaded,
} from "@/services/local-llama";
import { useColors } from "@/theme/ThemeProvider";

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
  const clearConversation = useAgentStore((s) => s.clearConversation);
  const setModelState = useAgentStore((s) => s.setModelState);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const modelPath = useSettingsStore((s) => s.modelPath);
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<AgentAttachment[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const keyboardPadding = useKeyboardPadding();
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
      <AgentHeader onClear={() => setShowClearConfirm(true)} />

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
              <Feather name={currentProvider === "local" ? "smartphone" : "cloud"} size={24} color={T.ink400} />
            </View>
            <Text className="text-base font-medium text-ink-500 text-center">Ask me anything</Text>
            <Text className="text-sm text-ink-400 mt-1 text-center max-w-[280px]">
              {currentProvider === "local"
                ? "Runs on your phone, offline and private. I can add and change events, tasks and notes for you."
                : hasKey
                  ? "Using NVIDIA NIM in the cloud, with every tool. Switch to On-device any time."
                  : "Add an NVIDIA NIM key in Settings, or switch to On-device to work offline."}
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
      <SheetModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        options={[
          { icon: "camera", label: "Take photo", onPress: () => addPhoto(true) },
          { icon: "image", label: "Choose from library", onPress: () => addPhoto(false) },
          { icon: "file", label: "Pick file", onPress: addFile },
        ]}
      />
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

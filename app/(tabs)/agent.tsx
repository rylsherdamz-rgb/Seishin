import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert, Image, ActivityIndicator,
} from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, withRepeat, withTiming, withSequence, useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { launchCameraAsync, launchImageLibraryAsync } from "expo-image-picker";
import { getDocumentAsync } from "expo-document-picker";
import { useAgentStore, AgentMessage, AgentAttachment } from "@/stores/agent-store";
import { useSettingsStore } from "@/stores/settings-store";
import { runAgentLoop, stopAgentLoop } from "@/services/agent-engine";
import { recognizeText } from "@/services/ocr";
import { uid } from "@/utils/id";
import * as Clipboard from "expo-clipboard";
import { Markdown } from "@/components/Markdown";
import Feather from "@expo/vector-icons/Feather";

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
  const {
    messages, currentProvider, installedSkills, isProcessing,
    load, setProvider, removeSkill, clearConversation,
  } = useAgentStore();
  const { apiKeys, nimModel, nimEndpoint, loadSettings } = useSettingsStore();
  const [input, setInput] = useState("");
  const [showSkills, setShowSkills] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    load();
    loadSettings();
  }, []);

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

  async function handleSend() {
    const text = input.trim();
    if (!text || isProcessing) return;
    setInput("");
    await runAgentLoop(text);
  }

  const [copiedId, setCopiedId] = useState<string | null>(null);
  async function copyToClipboard(text: string, id: string) {
    await Clipboard.setStringAsync(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  }

  const hasKey = !!apiKeys.nim;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <View className="px-4 pt-3 pb-2">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-2xl font-semibold tracking-tightest text-black">AI Agent</Text>
              <Text className="text-sm text-ink-500 mt-0.5">
                {currentProvider === "nim" ? "NVIDIA NIM" : "Local (offline)"}
                {isProcessing && " · Thinking..."}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowSkills(!showSkills)}
                className={`w-9 h-9 rounded-full items-center justify-center ${
                  showSkills ? "bg-black" : "bg-ink-100"
                }`}
              >
                <Feather name="package" size={14} color={showSkills ? "#ffffff" : "#666666"} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/settings")}
                className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center"
              >
                <Feather name="settings" size={14} color="#666666" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert("Clear", "Delete all messages?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Clear", style: "destructive", onPress: clearConversation },
                  ]);
                }}
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
                className="px-2.5 py-1 rounded-full bg-ink-100"
              >
                <Text className="text-xs text-ink-500 font-mono" numberOfLines={1}>
                  {nimModel.split("/").pop() || "model"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {showSkills && (
          <Animated.View key="agent-skills-panel" entering={FadeInDown.duration(200)} className="mx-4 mb-3 bg-ink-100 rounded-xl p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-medium text-black">Skills</Text>
              <Text className="text-xs text-ink-300">{installedSkills.length} installed</Text>
            </View>
            {installedSkills.length === 0 ? (
              <View className="py-4 items-center">
                <Feather name="package" size={20} color="#cccccc" />
                <Text className="text-xs text-ink-300 mt-2">No skills installed</Text>
              </View>
            ) : (
              installedSkills.map((s) => (
                <View key={s.name} className="flex-row items-center justify-between py-2 border-b border-ink-200 last:border-b-0">
                  <View className="flex-1">
                    <Text className="text-sm text-black font-medium">{s.name}</Text>
                    <Text className="text-xs text-ink-500">{s.description}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeSkill(s.name)}>
                    <Feather name="x-circle" size={16} color="#999999" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Animated.View>
        )}

        {!hasKey && currentProvider === "nim" && (
          <View key="agent-nim-nokey-banner" className="mx-4 mb-3 bg-danger-soft rounded-xl p-3 flex-row items-center gap-2">
            <Feather name="alert-circle" size={14} color="#ff3b30" />
            <Text className="text-xs text-danger flex-1">No NIM API key set. Go to Settings to add one.</Text>
          </View>
        )}
        {currentProvider === "local" && (
          <View key="agent-local-banner" className="mx-4 mb-3 bg-ink-100 rounded-xl p-3 flex-row items-center gap-2">
            <Feather name="info" size={14} color="#666666" />
            <Text className="text-xs text-ink-600 flex-1">Local GGUF mode not yet available. Switch to NVIDIA NIM.</Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-2"
          ListFooterComponent={isProcessing ? <ThinkingIndicator /> : null}
          renderItem={({ item }) => {
            const isUser = item.role === "user";
            // Don't render an empty assistant bubble (e.g. while the first token
            // is still coming, or a tool-only turn) — the footer dots show
            // "thinking", and tool results render as their own bubbles.
            if (!isUser && !item.content) return null;
            return (
              <View
                className={`mb-3 ${isUser ? "items-end" : "items-start"}`}
              >
                <View className={`max-w-[88%] px-4 py-3 ${
                  isUser
                    ? "bg-black rounded-2xl rounded-br-md"
                    : item.role === "tool"
                    ? "bg-ink-25 rounded-2xl rounded-bl-md border border-ink-150"
                    : "bg-white rounded-2xl rounded-bl-md border border-ink-100"
                }`}>
                  {item.toolName && (
                    <View className="flex-row items-center gap-1 mb-1">
                      <Feather name="terminal" size={10} color="#999999" />
                      <Text className="text-xs text-ink-400 font-mono">{item.toolName}</Text>
                    </View>
                  )}
                  {isUser ? (
                    <Text className="text-sm leading-5 text-white">{item.content}</Text>
                  ) : (
                    <Markdown content={item.content} />
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
              </View>
            );
          }}
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

        <View className="px-4 py-3 border-t border-ink-100 bg-white">
          <View className="flex-row gap-2 items-center">
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

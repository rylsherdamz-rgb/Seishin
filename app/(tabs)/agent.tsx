import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, withRepeat, withTiming, withSequence, useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAgentStore, AgentMessage } from "@/stores/agent-store";
import { useSettingsStore } from "@/stores/settings-store";
import { runAgentLoop, stopAgentLoop } from "@/services/agent-engine";
import Feather from "@expo/vector-icons/Feather";

const INITIAL_SUGGESTIONS = [
  { label: "Calendar events", query: "What events are on my calendar?" },
  { label: "Add a todo", query: "Add a todo to buy groceries due tomorrow" },
  { label: "Add event", query: "Add an event called Team Meeting tomorrow at 2pm" },
  { label: "System status", query: "What's my current setup?" },
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
              <Text className="text-2xl font-semibold tracking-tight text-black">AI Agent</Text>
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
          <Animated.View entering={FadeInDown.duration(200)} className="mx-4 mb-3 bg-ink-100 rounded-xl p-4">
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
          <View className="mx-4 mb-3 bg-danger-soft rounded-xl p-3 flex-row items-center gap-2">
            <Feather name="alert-circle" size={14} color="#ff3b30" />
            <Text className="text-xs text-danger flex-1">No NIM API key set. Go to Settings to add one.</Text>
          </View>
        )}
        {currentProvider === "local" && (
          <View className="mx-4 mb-3 bg-ink-100 rounded-xl p-3 flex-row items-center gap-2">
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
          renderItem={({ item, index }) => (
            <Animated.View
              entering={FadeInUp.duration(300).delay(index === messages.length - 1 ? 0 : 0)}
              className={`mb-3 ${item.role === "user" ? "items-end" : "items-start"}`}
            >
              <View className={`max-w-[80%] px-4 py-3 ${
                item.role === "user"
                  ? "bg-black rounded-2xl rounded-br-md"
                  : item.role === "tool"
                  ? "bg-ink-50 rounded-2xl rounded-bl-md border border-ink-200"
                  : "bg-ink-100 rounded-2xl rounded-bl-md"
              }`}>
                {item.toolName && (
                  <View className="flex-row items-center gap-1 mb-1">
                    <Feather name="terminal" size={10} color="#999999" />
                    <Text className="text-xs text-ink-400 font-mono">{item.toolName}</Text>
                  </View>
                )}
                <Text className={`text-sm leading-5 ${
                  item.role === "user" ? "text-white" : "text-black"
                }`}>
                  {item.content}
                </Text>
                <Text className={`text-xs mt-1.5 ${
                  item.role === "user" ? "text-ink-200" : "text-ink-400"
                }`}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </Animated.View>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-16 px-8">
              <View className="w-14 h-14 bg-ink-100 rounded-full items-center justify-center mb-4">
                <Feather name="cpu" size={22} color="#cccccc" />
              </View>
              <Text className="text-base text-ink-300 text-center">Ask me anything</Text>
              <Text className="text-sm text-ink-200 mt-1 text-center mb-8 max-w-[260px]">
                {hasKey
                  ? "I can manage your schedule, todos, and more"
                  : "Add an API key in Settings to use the AI agent"}
              </Text>
              <View className="gap-2 w-full">
                {INITIAL_SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.label}
                    onPress={() => setInput(s.query)}
                    className="bg-ink-100 px-4 py-3 rounded-xl flex-row items-center gap-3"
                  >
                    <Feather name="arrow-up-right" size={12} color="#999999" />
                    <Text className="text-sm text-ink-700">{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
        />

        <View className="px-4 py-3 border-t border-ink-200">
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 h-12 bg-ink-100 rounded-xl px-4 text-base text-black"
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
                className="h-12 w-12 items-center justify-center rounded-xl bg-danger"
              >
                <View className="w-4 h-4 bg-white rounded-sm" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim()}
                className={`h-12 w-12 items-center justify-center rounded-xl ${
                  input.trim() ? "bg-black" : "bg-ink-200"
                }`}
              >
                <Feather name="arrow-up" size={18} color={input.trim() ? "#ffffff" : "#cccccc"} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

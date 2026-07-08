import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { useAgentStore, AgentMessage } from "@/stores/agent-store";
import { runAgentLoop } from "@/services/agent-engine";
import Feather from "@expo/vector-icons/Feather";

const INITIAL_SUGGESTIONS = [
  { label: "Calendar events", query: "What events are on my calendar?" },
  { label: "Add a todo", query: "Add a todo to buy groceries" },
  { label: "Generate invite", query: "Generate a P2P invite code" },
  { label: "System status", query: "What's my current setup?" },
];

export default function AgentScreen() {
  const {
    messages, currentProvider, installedSkills, isProcessing,
    load, setProvider, removeSkill, clearConversation,
  } = useAgentStore();
  const [input, setInput] = useState("");
  const [showSkills, setShowSkills] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => { load(); }, []);

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

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View className="pt-16 px-4 pb-2">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-2xl font-semibold tracking-tight text-black">AI Agent</Text>
            <Text className="text-sm text-ink-500 mt-0.5">
              {currentProvider === "nim" ? "NVIDIA NIM" : "Local (offline)"}
              {isProcessing && " · Processing..."}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setShowSkills(!showSkills)}
              className={`w-9 h-9 rounded-full items-center justify-center ${
                showSkills ? "bg-black" : "bg-ink-100"
              }`}
            >
              <Feather
                name="package"
                size={14}
                color={showSkills ? "#ffffff" : "#666666"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Clear Conversation", "Delete all messages?", [
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

        <View className="flex-row gap-2">
          {(["local", "nim"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setProvider(p)}
              className={`px-3 py-1.5 rounded-full ${
                currentProvider === p ? "bg-black" : "bg-ink-100"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  currentProvider === p ? "text-white" : "text-ink-500"
                }`}
              >
                {p === "nim" ? "NVIDIA NIM" : "Local GGUF"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {showSkills && (
        <View className="mx-4 mb-3 bg-ink-100 rounded-xl p-4">
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
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert("Remove Skill", `Remove "${s.name}"?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Remove", style: "destructive", onPress: () => removeSkill(s.name) },
                    ]);
                  }}
                  className="ml-2"
                >
                  <Feather name="x-circle" size={16} color="#999999" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-2"
        renderItem={({ item }) => (
          <View className={`mb-3 ${item.role === "user" ? "items-end" : "items-start"}`}>
            <View
              className={`max-w-[80%] px-4 py-3 ${
                item.role === "user"
                  ? "bg-black rounded-2xl rounded-br-md"
                  : "bg-ink-100 rounded-2xl rounded-bl-md"
              }`}
            >
              <Text className={`text-sm leading-5 ${item.role === "user" ? "text-white" : "text-black"}`}>
                {item.content}
              </Text>
              <Text className={`text-xs mt-1.5 ${item.role === "user" ? "text-gray-400" : "text-ink-300"}`}>
                {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-16 px-8">
            <View className="w-14 h-14 bg-ink-100 rounded-full items-center justify-center mb-4">
              <Feather name="cpu" size={22} color="#cccccc" />
            </View>
            <Text className="text-base text-ink-300 text-center">Ask me anything</Text>
            <Text className="text-sm text-ink-200 mt-1 text-center mb-8">
              I help manage your schedule, todos, and more
            </Text>
            <View className="gap-2 w-full">
              {INITIAL_SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s.label}
                  onPress={() => setInput(s.query)}
                  className="bg-ink-100 px-4 py-3 rounded-lg flex-row items-center gap-3"
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
            className="flex-1 h-12 border border-ink-200 rounded-xl px-4 text-base text-black"
            placeholder={isProcessing ? "AI is thinking..." : "Type a message..."}
            placeholderTextColor="#999999"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            editable={!isProcessing}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || isProcessing}
            className={`h-12 w-12 items-center justify-center rounded-xl ${
              input.trim() && !isProcessing ? "bg-black" : "bg-ink-200"
            }`}
          >
            <Feather
              name="arrow-up"
              size={18}
              color={input.trim() && !isProcessing ? "#ffffff" : "#cccccc"}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

import { View, Text } from "react-native";

export default function AgentScreen() {
  return (
    <View className="flex-1 bg-white px-4 pt-16">
      <Text className="text-2xl font-semibold text-black mb-6">
        AI Agent
      </Text>
      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-gray-500">
          Your personal AI assistant
        </Text>
        <Text className="text-sm text-gray-400 mt-2">
          Ask me to manage your schedule, scan documents, and more
        </Text>
      </View>
    </View>
  );
}

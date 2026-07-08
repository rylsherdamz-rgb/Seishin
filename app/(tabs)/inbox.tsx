import { View, Text } from "react-native";

export default function InboxScreen() {
  return (
    <View className="flex-1 bg-white px-4 pt-16">
      <Text className="text-2xl font-semibold text-black mb-6">Inbox</Text>
      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-gray-500">No messages yet</Text>
        <Text className="text-sm text-gray-400 mt-2">
          Notifications, emails, and chat messages appear here
        </Text>
      </View>
    </View>
  );
}

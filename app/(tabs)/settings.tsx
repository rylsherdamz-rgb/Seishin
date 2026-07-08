import { View, Text } from "react-native";

export default function SettingsScreen() {
  return (
    <View className="flex-1 bg-white px-4 pt-16">
      <Text className="text-2xl font-semibold text-black mb-6">Settings</Text>
      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-gray-500">Settings</Text>
        <Text className="text-sm text-gray-400 mt-2">
          Configure email, notifications, models, and storage
        </Text>
      </View>
    </View>
  );
}

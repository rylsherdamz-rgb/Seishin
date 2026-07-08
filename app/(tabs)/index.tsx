import { View, Text } from "react-native";

export default function CalendarScreen() {
  return (
    <View className="flex-1 bg-white px-4 pt-16">
      <Text className="text-2xl font-semibold text-black mb-6">Calendar</Text>
      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-gray-500">No events yet</Text>
        <Text className="text-sm text-gray-400 mt-2">
          Events will appear here from OCR, email, and notifications
        </Text>
      </View>
    </View>
  );
}

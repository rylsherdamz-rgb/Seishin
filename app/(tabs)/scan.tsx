import { View, Text } from "react-native";

export default function ScanScreen() {
  return (
    <View className="flex-1 bg-white px-4 pt-16">
      <Text className="text-2xl font-semibold text-black mb-6">Scan</Text>
      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-gray-500">Scan a schedule</Text>
        <Text className="text-sm text-gray-400 mt-2">
          Take a photo of your schedule to auto-create events
        </Text>
      </View>
    </View>
  );
}

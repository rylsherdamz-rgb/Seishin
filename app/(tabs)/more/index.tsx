import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/ui/Card";

const items = [
  {
    title: "Todo List",
    subtitle: "Manage tasks and to-dos",
    route: "/more/todo",
    icon: "☐",
  },
  {
    title: "Invites",
    subtitle: "Invitation cards, P2P codes, shared lists",
    route: "/more/invites",
    icon: "✉",
  },
];

export default function MoreScreen() {
  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-4">
        <Text className="text-2xl font-semibold text-black">More</Text>
      </View>

      <View className="px-4">
        {items.map((item) => (
          <TouchableOpacity key={item.route} onPress={() => router.push(item.route)}>
            <Card className="flex-row items-center gap-4 mb-3">
              <Text className="text-2xl">{item.icon}</Text>
              <View className="flex-1">
                <Text className="text-base font-medium text-black">{item.title}</Text>
                <Text className="text-sm text-gray-500">{item.subtitle}</Text>
              </View>
              <Text className="text-gray-400">›</Text>
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

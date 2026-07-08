import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/Logo";
import Feather from "@expo/vector-icons/Feather";

const items = [
  {
    title: "Todo List",
    subtitle: "Manage tasks and to-dos",
    route: "/more/todo",
    icon: "check-square" as const,
  },
  {
    title: "Invites",
    subtitle: "Invitation cards, P2P codes, shared lists",
    route: "/more/invites",
    icon: "send" as const,
  },
];

export default function MoreScreen() {
  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-4 flex-row items-center gap-4">
        <Logo size={44} />
        <View>
          <Text className="text-2xl font-semibold tracking-tight text-black">Seishin</Text>
          <Text className="text-sm text-ink-500 mt-0.5">More features</Text>
        </View>
      </View>

      <View className="px-4">
        {items.map((item) => (
          <TouchableOpacity key={item.route} onPress={() => router.push(item.route)}>
            <Card className="flex-row items-center gap-4 mb-3">
              <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                <Feather name={item.icon} size={16} color="#000000" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-black">{item.title}</Text>
                <Text className="text-xs text-ink-500 mt-0.5">{item.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#cccccc" />
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { Card } from "@/components/ui/Card";
import Feather from "@expo/vector-icons/Feather";

const FILTERS = ["all", "notifications", "emails", "chats"] as const;

const typeIcons: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  notification: "bell",
  email: "mail",
  chat: "message-circle",
};

export default function InboxScreen() {
  const { items, loadItems, markRead, deleteItem, clearAll, getUnreadCount } = useInboxStore();
  const [localFilter, setLocalFilter] = useState<string>("all");

  useEffect(() => { loadItems(); }, []);

  const filtered = items.filter((i) => {
    if (localFilter === "all") return true;
    return i.type === localFilter;
  });

  function handleLongPress(item: InboxItem) {
    Alert.alert(item.title, item.body, [
      { text: "Mark Read", onPress: () => markRead(item.id) },
      { text: "Delete", style: "destructive", onPress: () => deleteItem(item.id) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-1">
          <View>
            <Text className="text-2xl font-semibold tracking-tight text-black">Inbox</Text>
            <Text className="text-sm text-ink-500 mt-0.5">
              {getUnreadCount()} unread · {items.length} total
            </Text>
          </View>
          {items.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Clear All", "Delete all messages?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Clear All", style: "destructive", onPress: clearAll },
                ]);
              }}
              className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center"
            >
              <Feather name="trash-2" size={14} color="#000000" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View className="flex-row px-4 gap-2 mb-4">
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setLocalFilter(f)}
            className={`px-3 py-1.5 rounded-full border ${
              localFilter === f ? "bg-black border-black" : "border-ink-200"
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                localFilter === f ? "text-white" : "text-ink-500"
              }`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <TouchableOpacity onLongPress={() => handleLongPress(item)} onPress={() => { if (!item.read) markRead(item.id); }}>
            <Card className={`mb-2 ${!item.read ? "border-l-2 border-black" : ""}`}>
              <View className="flex-row items-start gap-3">
                <View className={`w-9 h-9 rounded-full items-center justify-center ${
                  item.read ? "bg-ink-100" : "bg-black"
                }`}>
                  <Feather
                    name={typeIcons[item.type] || "bell"}
                    size={14}
                    color={item.read ? "#999999" : "#ffffff"}
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className={`text-sm flex-1 ${item.read ? "text-ink-500" : "text-black font-medium"}`}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    <Text className="text-xs text-ink-300">
                      {new Date(item.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                  <Text className="text-xs text-ink-500 mt-0.5" numberOfLines={2}>
                    {item.body}
                  </Text>
                  <View className="flex-row items-center gap-1 mt-1.5">
                    <Feather name="at-sign" size={10} color="#cccccc" />
                    <Text className="text-xs text-ink-200">{item.source}</Text>
                  </View>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <View className="w-14 h-14 bg-ink-100 rounded-full items-center justify-center mb-4">
              <Feather name="inbox" size={22} color="#cccccc" />
            </View>
            <Text className="text-base text-ink-300">No messages yet</Text>
            <Text className="text-sm text-ink-200 mt-1 text-center">
              Notifications, emails, and chats appear here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";

import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { SheetModal } from "@/components/ui/SheetModal";
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
  const [showItemSheet, setShowItemSheet] = useState(false);
  const [sheetItem, setSheetItem] = useState<InboxItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => { loadItems(); }, []);

  const filtered = items.filter((i) => {
    if (localFilter === "all") return true;
    return i.type === localFilter;
  });

  function handleLongPress(item: InboxItem) {
    setSheetItem(item);
    setShowItemSheet(true);
  }

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-1">
          <View>
            <Text className="text-2xl font-semibold tracking-tightest text-black">Inbox</Text>
            <Text className="text-sm text-ink-500 mt-0.5">
              {getUnreadCount()} unread · {items.length} total
            </Text>
          </View>
          {items.length > 0 && (
            <IconButton
              icon="trash-2"
              onPress={() => setShowClearConfirm(true)}
            />
          )}
        </View>
      </View>

      <View className="flex-row px-4 gap-2 mb-4">
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            active={localFilter === f}
            onPress={() => setLocalFilter(f)}
          />
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onLongPress={() => handleLongPress(item)} onPress={() => { if (!item.read) markRead(item.id); }}>
            <Card variant="elevated" className={`mb-2.5 ${!item.read ? "border-l-[3px] border-l-black" : ""}`}>
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
          <EmptyState
            icon="inbox"
            title="No messages yet"
            subtitle="Notifications, emails, and chats appear here"
          />
        }
      />
      <SheetModal
        visible={showItemSheet && sheetItem !== null}
        onClose={() => { setShowItemSheet(false); setSheetItem(null); }}
        title={sheetItem?.title}
        message={sheetItem?.body}
        options={[
          { icon: "check-circle", label: "Mark Read", onPress: () => { if (sheetItem) markRead(sheetItem.id); } },
          { icon: "trash-2", label: "Delete", destructive: true, onPress: () => { if (sheetItem) deleteItem(sheetItem.id); } },
        ]}
      />
      <SheetModal
        visible={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All"
        message="Delete all messages?"
        confirmLabel="Clear All"
        confirmDestructive
        onConfirm={clearAll}
      />
    </View>
  );
}

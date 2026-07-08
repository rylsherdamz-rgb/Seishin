import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useInvitesStore, InviteCard } from "@/stores/invites-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Feather from "@expo/vector-icons/Feather";

type InviteTab = "cards" | "p2p" | "shared";

export default function InvitesScreen() {
  const { invites, loadInvites, addInvite, deleteInvite, generateP2pCode, shareTodoList } = useInvitesStore();
  const [tab, setTab] = useState<InviteTab>("cards");
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardDesc, setNewCardDesc] = useState("");

  useEffect(() => { loadInvites(); }, []);

  function createInviteCard() {
    if (!newCardTitle.trim()) return;
    const invite: InviteCard = {
      id: `card-${Date.now()}`,
      type: "invite-card",
      title: newCardTitle,
      description: newCardDesc,
      status: "draft",
      createdAt: new Date().toISOString(),
      data: {},
    };
    addInvite(invite);
    setNewCardTitle("");
    setNewCardDesc("");
  }

  async function shareInvite(invite: InviteCard) {
    await Share.share({
      message: `Seishin Invite: ${invite.title}\n${invite.description || ""}\nCode: ${invite.code || "N/A"}`,
    });
  }

  const typeIcons: Record<InviteTab, React.ComponentProps<typeof Feather>["name"]> = {
    cards: "file-text",
    p2p: "wifi",
    shared: "share-2",
  };

  const filtered = invites.filter((i) => {
    if (tab === "cards") return i.type === "invite-card";
    if (tab === "p2p") return i.type === "p2p-code";
    if (tab === "shared") return i.type === "shared-todo";
    return true;
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-4 pt-3 pb-2 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
          <Feather name="arrow-left" size={16} color="#000000" />
        </TouchableOpacity>
        <Text className="text-xl font-semibold tracking-tight text-black flex-1">Invites</Text>
        <Text className="text-xs text-ink-500">{invites.length} total</Text>
      </View>

      <View className="flex-row px-4 gap-2 mb-4">
        {(["cards", "p2p", "shared"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
              tab === t ? "bg-black border-black" : "border-ink-200"
            }`}
          >
            <Feather
              name={typeIcons[t]}
              size={11}
              color={tab === t ? "#ffffff" : "#999999"}
            />
            <Text className={`text-xs font-medium ${tab === t ? "text-white" : "text-ink-500"}`}>
              {t === "cards" ? "Cards" : t === "p2p" ? "P2P Codes" : "Shared"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "cards" && (
        <View className="px-4 mb-4">
          <TextInput
            className="h-12 border border-ink-200 rounded-xl px-4 text-base text-black mb-2"
            placeholder="Event title..."
            placeholderTextColor="#999999"
            value={newCardTitle}
            onChangeText={setNewCardTitle}
          />
          <TextInput
            className="h-12 border border-ink-200 rounded-xl px-4 text-base text-black mb-3"
            placeholder="Description (optional)"
            placeholderTextColor="#999999"
            value={newCardDesc}
            onChangeText={setNewCardDesc}
          />
          <Button
            title="Create Invitation Card"
            onPress={createInviteCard}
            icon={<Feather name="plus" size={14} color="#ffffff" />}
          />
        </View>
      )}

      {tab === "p2p" && (
        <View className="px-4 mb-4">
          <Button
            title="Generate P2P Code"
            onPress={() => {
              const code = generateP2pCode();
              Alert.alert("Code Generated", `Share this code: ${code}`);
            }}
            icon={<Feather name="wifi" size={14} color="#ffffff" />}
          />
        </View>
      )}

      {tab === "shared" && (
        <View className="px-4 mb-4">
          <Button
            title="Share Todo List"
            onPress={() => {
              const code = shareTodoList([]);
              Alert.alert("Share Code", `Share this code with a friend: ${code}`);
            }}
            icon={<Feather name="share-2" size={14} color="#ffffff" />}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row items-start gap-3">
              <View className="w-9 h-9 bg-white rounded-full items-center justify-center">
                <Feather
                  name={item.type === "invite-card" ? "file-text" : item.type === "p2p-code" ? "wifi" : "share-2"}
                  size={14}
                  color="#000000"
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-black">{item.title}</Text>
                {item.description && (
                  <Text className="text-xs text-ink-500 mt-0.5">{item.description}</Text>
                )}
                {item.code && (
                  <View className="bg-white px-3 py-1.5 rounded border border-ink-200 mt-2 self-start">
                    <Text className="text-sm font-mono tracking-widest text-black">{item.code}</Text>
                  </View>
                )}
                <View className="flex-row items-center gap-3 mt-2">
                  <View className="flex-row items-center gap-1">
                    <Feather name="clock" size={10} color="#cccccc" />
                    <Text className="text-xs text-ink-300">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text className="text-xs text-ink-200">·</Text>
                  <Text className="text-xs text-ink-300 capitalize">{item.status}</Text>
                </View>
              </View>
              <View className="gap-2">
                <TouchableOpacity onPress={() => shareInvite(item)}>
                  <Feather name="share-2" size={14} color="#666666" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert("Delete Invite", "Delete this invite?", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteInvite(item.id) },
                    ]);
                  }}
                >
                  <Feather name="trash-2" size={14} color="#999999" />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <View className="w-14 h-14 bg-ink-100 rounded-full items-center justify-center mb-4">
              <Feather name="send" size={20} color="#cccccc" />
            </View>
            <Text className="text-base text-ink-300">No invites yet</Text>
            <Text className="text-xs text-ink-200 mt-1">Create one above</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

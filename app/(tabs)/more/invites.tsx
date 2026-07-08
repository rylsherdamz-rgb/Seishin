import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, Share } from "react-native";
import { useInvitesStore, InviteCard } from "@/stores/invites-store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
    setTab("cards");
  }

  async function shareInvite(invite: InviteCard) {
    await Share.share({
      message: `Seishin Invite: ${invite.title}\n${invite.description || ""}\nCode: ${invite.code || "N/A"}`,
    });
  }

  const filtered = invites.filter((i) => {
    if (tab === "cards") return i.type === "invite-card";
    if (tab === "p2p") return i.type === "p2p-code";
    if (tab === "shared") return i.type === "shared-todo";
    return true;
  });

  return (
    <View className="flex-1 bg-white">
      <View className="pt-16 px-4 pb-4">
        <Text className="text-2xl font-semibold text-black">Invites</Text>
      </View>

      <View className="flex-row px-4 gap-2 mb-4">
        {(["cards", "p2p", "shared"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            className={`px-4 py-2 rounded-full border ${
              tab === t ? "bg-black border-black" : "border-gray-300"
            }`}
          >
            <Text className={`text-sm ${tab === t ? "text-white" : "text-gray-600"}`}>
              {t === "cards" ? "Cards" : t === "p2p" ? "P2P Codes" : "Shared"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "cards" && (
        <View className="px-4 mb-4">
          <TextInput
            className="h-12 border border-black rounded-lg px-4 text-base text-black mb-2"
            placeholder="Event title..."
            placeholderTextColor="#999"
            value={newCardTitle}
            onChangeText={setNewCardTitle}
          />
          <TextInput
            className="h-12 border border-gray-300 rounded-lg px-4 text-base text-black mb-2"
            placeholder="Description (optional)..."
            placeholderTextColor="#999"
            value={newCardDesc}
            onChangeText={setNewCardDesc}
          />
          <Button title="Create Invitation Card" onPress={createInviteCard} />
        </View>
      )}

      {tab === "p2p" && (
        <View className="px-4 mb-4">
          <Button
            title="Generate P2P Code"
            onPress={() => {
              const code = generateP2pCode();
              Alert.alert("P2P Code Generated", `Share this code: ${code}`);
            }}
          />
        </View>
      )}

      {tab === "shared" && (
        <View className="px-4 mb-4">
          <Button
            title="Share Todo List"
            onPress={() => {
              const code = shareTodoList([]);
              Alert.alert("Share Code Generated", `Code: ${code}\nShare this with a friend to share your todos.`);
            }}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <Card className="mb-2">
            <View className="flex-row justify-between items-start">
              <View className="flex-1">
                <Text className="text-sm font-medium text-black">{item.title}</Text>
                {item.description && (
                  <Text className="text-xs text-gray-500 mt-1">{item.description}</Text>
                )}
                {item.code && (
                  <View className="bg-ink-100 px-3 py-1 rounded mt-2 self-start">
                    <Text className="text-sm font-mono text-black">{item.code}</Text>
                  </View>
                )}
                <Text className="text-xs text-gray-400 mt-1">
                  {new Date(item.createdAt).toLocaleDateString()} · {item.status}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity onPress={() => shareInvite(item)}>
                  <Text className="text-black text-sm">Share</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  Alert.alert("Delete Invite", "Delete this invite?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => deleteInvite(item.id) },
                  ]);
                }}>
                  <Text className="text-red-500 text-sm">Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <Text className="text-gray-400 text-base">No invites yet</Text>
          </View>
        }
      />
    </View>
  );
}

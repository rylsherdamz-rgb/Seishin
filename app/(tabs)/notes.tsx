import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useNotesStore, Note } from "@/stores/notes-store";
import { EmptyState } from "@/components/ui/EmptyState";
import Feather from "@expo/vector-icons/Feather";

export default function NotesScreen() {
  const { notes, query, loadNotes, setQuery, getFilteredNotes } = useNotesStore();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => { loadNotes(); }, []);
  // Refresh when returning from the editor so edits show immediately.
  useFocusEffect(useCallback(() => { loadNotes(); }, []));

  const filtered = getFilteredNotes().filter((n) => !activeTag || n.tags.includes(activeTag));
  const pinned = filtered.filter((n) => n.pinned);
  const others = filtered.filter((n) => !n.pinned);

  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags))).sort();

  function openNote(id?: string) {
    router.push(id ? { pathname: "/note", params: { id } } : "/note");
  }

  // The + button offers a blank note or starting from an upload. Attachment
  // actions open the editor with a launch param so the picker + OCR run there.
  function onAddPress() {
    Alert.alert("New Note", "Start a blank note or add an attachment", [
      { text: "Cancel", style: "cancel" },
      { text: "Blank Note", onPress: () => openNote() },
      { text: "Take Photo", onPress: () => router.push({ pathname: "/note", params: { action: "camera" } }) },
      { text: "Choose Photo", onPress: () => router.push({ pathname: "/note", params: { action: "photo" } }) },
      { text: "Upload File", onPress: () => router.push({ pathname: "/note", params: { action: "file" } }) },
    ]);
  }

  function renderCard(item: Note) {
    const firstImage = item.attachments.find((a) => a.type === "image");
    const fileCount = item.attachments.filter((a) => a.type === "file").length;
    return (
      <TouchableOpacity
        key={item.id}
        onPress={() => openNote(item.id)}
        activeOpacity={0.7}
        className="flex-1 m-1.5 bg-white rounded-card border border-ink-100 shadow-card overflow-hidden"
      >
        {firstImage && (
          <Image source={{ uri: firstImage.uri }} className="w-full h-24 bg-ink-100" resizeMode="cover" />
        )}
        <View className="p-3.5">
          <View className="flex-row items-start justify-between">
            {item.title ? (
              <Text className="text-sm font-semibold text-black flex-1" numberOfLines={2}>{item.title}</Text>
            ) : (
              <Text className="text-sm font-semibold text-ink-300 flex-1">Untitled</Text>
            )}
            {item.pinned && <Feather name="bookmark" size={13} color="#000000" />}
          </View>
          {item.body ? (
            <Text className="text-xs text-ink-600 mt-1.5 leading-5" numberOfLines={firstImage ? 4 : 8}>
              {item.body}
            </Text>
          ) : null}
          {(item.tags.length > 0 || item.eventId || fileCount > 0) && (
            <View className="flex-row flex-wrap items-center gap-1 mt-2.5">
              {item.eventId && (
                <View className="flex-row items-center gap-1 px-2 py-0.5 bg-black rounded-full">
                  <Feather name="calendar" size={9} color="#ffffff" />
                  <Text className="text-[9px] font-semibold text-white">event</Text>
                </View>
              )}
              {fileCount > 0 && (
                <View className="flex-row items-center gap-1 px-2 py-0.5 bg-ink-100 rounded-full">
                  <Feather name="paperclip" size={9} color="#666666" />
                  <Text className="text-[9px] font-semibold text-ink-600">{fileCount}</Text>
                </View>
              )}
              {item.tags.map((t) => (
                <View key={t} className="px-2 py-0.5 bg-ink-100 rounded-full">
                  <Text className="text-[9px] font-semibold text-ink-600">#{t}</Text>
                </View>
              ))}
            </View>
          )}
          <Text className="text-[10px] text-ink-300 mt-2">
            {new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const columns = (list: Note[]) => {
    const rows: Note[][] = [];
    for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
    return rows;
  };

  const hasNotes = pinned.length + others.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-semibold tracking-tightest text-black">Notes</Text>
          <Text className="text-sm text-ink-500 mt-1">{notes.length} note{notes.length === 1 ? "" : "s"}</Text>
        </View>
        <TouchableOpacity
          onPress={onAddPress}
          activeOpacity={0.85}
          className="w-11 h-11 bg-black rounded-full items-center justify-center shadow-raised"
        >
          <Feather name="plus" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View className="mx-4 mb-3 h-11 bg-ink-50 rounded-xl px-4 flex-row items-center gap-2">
        <Feather name="search" size={15} color="#999999" />
        <TextInput
          className="flex-1 text-sm text-black"
          placeholder="Search notes"
          placeholderTextColor="#999999"
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Feather name="x-circle" size={15} color="#cccccc" />
          </TouchableOpacity>
        )}
      </View>

      {allTags.length > 0 && (
        <View className="mb-2">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={["all", ...allTags]}
            keyExtractor={(t) => t}
            contentContainerClassName="px-4 gap-2"
            renderItem={({ item: t }) => {
              const active = t === "all" ? activeTag === null : activeTag === t;
              return (
                <TouchableOpacity
                  onPress={() => setActiveTag(t === "all" ? null : t)}
                  activeOpacity={0.7}
                  className={`px-3.5 py-2 rounded-full border ${active ? "bg-black border-black" : "bg-white border-ink-200"}`}
                >
                  <Text className={`text-xs font-semibold ${active ? "text-white" : "text-ink-500"}`}>
                    {t === "all" ? "All" : `#${t}`}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {hasNotes ? (
        <FlatList
          data={[
            ...(pinned.length > 0 ? [{ _header: "Pinned" } as const] : []),
            ...columns(pinned),
            ...(pinned.length > 0 && others.length > 0 ? [{ _header: "Others" } as const] : []),
            ...columns(others),
          ]}
          keyExtractor={(row, i) => ("_header" in row ? `h-${row._header}` : `row-${i}-${row[0]?.id}`)}
          contentContainerClassName="px-2.5 pb-8"
          renderItem={({ item }) => {
            if ("_header" in item) {
              return (
                <Text className="text-[11px] font-bold text-ink-400 tracking-widest px-2 pt-3 pb-1">
                  {item._header.toUpperCase()}
                </Text>
              );
            }
            return (
              <View className="flex-row items-start">
                {item.map(renderCard)}
                {item.length === 1 && <View className="flex-1 m-1.5" />}
              </View>
            );
          }}
        />
      ) : (
        <EmptyState
          icon="file-text"
          title={query ? "No matching notes" : "No notes yet"}
          subtitle={query ? "Try a different search" : "Tap + to create a note — add text, photos, or files"}
        />
      )}
    </SafeAreaView>
  );
}

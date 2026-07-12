import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useNotesStore, Note } from "@/stores/notes-store";
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetModal } from "@/components/ui/SheetModal";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import Feather from "@expo/vector-icons/Feather";

export default function NotesScreen() {
  const { notes, query, loadNotes, setQuery, getFilteredNotes } = useNotesStore();
  const { items, loadItems, markRead, deleteItem, clearAll, getUnreadCount } = useInboxStore();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tab, setTab] = useState<"notes" | "inbox">("notes");
  const [localFilter, setLocalFilter] = useState<string>("all");
  const [showItemSheet, setShowItemSheet] = useState(false);
  const [sheetItem, setSheetItem] = useState<InboxItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => { loadNotes(); loadItems(); }, []);
  useFocusEffect(useCallback(() => { loadNotes(); }, []));

  const filteredNotes = getFilteredNotes().filter((n) => !activeTag || n.tags.includes(activeTag));
  const pinned = filteredNotes.filter((n) => n.pinned);
  const others = filteredNotes.filter((n) => !n.pinned);

  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags))).sort();

  const inboxFiltered = items.filter((i) => {
    if (localFilter === "all") return true;
    return i.type === localFilter;
  });

  const FILTERS = ["all", "notification", "email", "chat"] as const;
  const typeIcons: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
    notification: "bell", email: "mail", chat: "message-circle",
  };

  function openNote(id?: string) {
    router.push(id ? { pathname: "/note", params: { id } } : "/note");
  }

  const [showNewNoteSheet, setShowNewNoteSheet] = useState(false);

  function onAddPress() {
    setShowNewNoteSheet(true);
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
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-semibold tracking-tightest text-black">
            {tab === "notes" ? "Notes" : "Inbox"}
          </Text>
          <Text className="text-sm text-ink-500 mt-1">
            {tab === "notes"
              ? `${notes.length} note${notes.length === 1 ? "" : "s"}`
              : `${getUnreadCount()} unread · ${items.length} total`
            }
          </Text>
        </View>
        <View className="flex-row gap-2 items-center">
          {tab === "notes" ? (
            <TouchableOpacity
              onPress={onAddPress}
              activeOpacity={0.85}
              className="w-11 h-11 bg-black rounded-full items-center justify-center shadow-raised"
            >
              <Feather name="plus" size={20} color="#ffffff" />
            </TouchableOpacity>
          ) : (
            items.length > 0 && (
              <IconButton icon="trash-2" onPress={() => setShowClearConfirm(true)} />
            )
          )}
        </View>
      </View>

      <View className="flex-row mx-4 mb-3 bg-ink-50 rounded-xl p-0.5">
        <TouchableOpacity
          onPress={() => setTab("notes")}
          activeOpacity={0.7}
          className={`flex-1 py-2 rounded-xl items-center ${tab === "notes" ? "bg-white shadow-subtle" : ""}`}
        >
          <Text className={`text-sm font-semibold ${tab === "notes" ? "text-black" : "text-ink-400"}`}>Notes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab("inbox")}
          activeOpacity={0.7}
          className={`flex-1 py-2 rounded-xl items-center ${tab === "inbox" ? "bg-white shadow-subtle" : ""}`}
        >
          <Text className={`text-sm font-semibold ${tab === "inbox" ? "text-black" : "text-ink-400"}`}>Inbox</Text>
        </TouchableOpacity>
      </View>

      {tab === "notes" ? (
        <>
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
        </>
      ) : (
        <>
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
            data={inboxFiltered}
            keyExtractor={(item) => item.id}
            contentContainerClassName="px-4 pb-8"
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => { setSheetItem(item); setShowItemSheet(true); }}
                onPress={() => { if (!item.read) markRead(item.id); }}
              >
                <Card variant="elevated" className={`mb-2.5 ${!item.read ? "border-l-[3px] border-l-black" : ""}`}>
                  <View className="flex-row items-start gap-3">
                    <View className={`w-9 h-9 rounded-full items-center justify-center ${item.read ? "bg-ink-100" : "bg-black"}`}>
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
                          {new Date(item.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
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
              <EmptyState icon="inbox" title="No messages yet" subtitle="Notifications, emails, and chats appear here" />
            }
          />
        </>
      )}

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
      <SheetModal
        visible={showNewNoteSheet}
        onClose={() => setShowNewNoteSheet(false)}
        title="New Note"
        message="Start a blank note or add an attachment"
        options={[
          { icon: "file-text", label: "Blank Note", onPress: () => openNote() },
          { icon: "camera", label: "Take Photo", onPress: () => router.push({ pathname: "/note", params: { action: "camera" } }) },
          { icon: "image", label: "Choose Photo", onPress: () => router.push({ pathname: "/note", params: { action: "photo" } }) },
          { icon: "paperclip", label: "Upload File", onPress: () => router.push({ pathname: "/note", params: { action: "file" } }) },
        ]}
      />
    </View>
  );
}

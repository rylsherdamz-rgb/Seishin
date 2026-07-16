import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, Alert } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useNotesStore, Note } from "@/stores/notes-store";
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { useAgentStore, AgentMessage } from "@/stores/agent-store";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetModal } from "@/components/ui/SheetModal";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import Feather from "@expo/vector-icons/Feather";
import { uid } from "@/utils/id";

const FILTERS = ["all", "notification", "email", "chat"] as const;
const typeIcons: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  notification: "bell", email: "mail", chat: "message-circle",
};

export default function NotesScreen() {
  const notes = useNotesStore((s) => s.notes);
  const query = useNotesStore((s) => s.query);
  const loadNotes = useNotesStore((s) => s.loadNotes);
  const setQuery = useNotesStore((s) => s.setQuery);
  const getFilteredNotes = useNotesStore((s) => s.getFilteredNotes);
  const items = useInboxStore((s) => s.items);
  const loadItems = useInboxStore((s) => s.loadItems);
  const markRead = useInboxStore((s) => s.markRead);
  const deleteItem = useInboxStore((s) => s.deleteItem);
  const clearAll = useInboxStore((s) => s.clearAll);
  const getUnreadCount = useInboxStore((s) => s.getUnreadCount);
  const selectedIds = useInboxStore((s) => s.selectedIds);
  const selecting = useInboxStore((s) => s.selecting);
  const toggleSelect = useInboxStore((s) => s.toggleSelect);
  const selectAll = useInboxStore((s) => s.selectAll);
  const clearSelection = useInboxStore((s) => s.clearSelection);
  const setSelecting = useInboxStore((s) => s.setSelecting);
  const deleteSelected = useInboxStore((s) => s.deleteSelected);
  const markSelectedRead = useInboxStore((s) => s.markSelectedRead);
  const addMessage = useAgentStore((s) => s.addMessage);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tab, setTab] = useState<"notes" | "inbox">("notes");
  const [localFilter, setLocalFilter] = useState<string>("all");
  const [showItemSheet, setShowItemSheet] = useState(false);
  const [sheetItem, setSheetItem] = useState<InboxItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => { loadNotes(); loadItems(); }, [loadNotes, loadItems]);
  useFocusEffect(useCallback(() => { loadNotes(); }, [loadNotes]));

  const filteredNotes = useMemo(() => {
    return getFilteredNotes().filter((n) => !activeTag || n.tags.includes(activeTag));
  }, [getFilteredNotes, activeTag]);

  const pinned = useMemo(() => filteredNotes.filter((n) => n.pinned), [filteredNotes]);
  const others = useMemo(() => filteredNotes.filter((n) => !n.pinned), [filteredNotes]);

  const allTags = useMemo(
    () => Array.from(new Set(notes.flatMap((n) => n.tags))).sort(),
    [notes]
  );

  const inboxFiltered = useMemo(() => {
    return items.filter((i) => localFilter === "all" || i.type === localFilter);
  }, [items, localFilter]);

  const openNote = useCallback((id?: string) => {
    router.push(id ? { pathname: "/note", params: { id } } : "/note");
  }, []);

  const [showNewNoteSheet, setShowNewNoteSheet] = useState(false);

  const onAddPress = useCallback(() => setShowNewNoteSheet(true), []);

  const renderCard = useCallback((item: Note) => {
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
  }, [openNote]);

  const columns = useCallback((list: Note[]) => {
    const rows: Note[][] = [];
    for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
    return rows;
  }, []);

  const hasNotes = pinned.length + others.length > 0;

  const noteListData = useMemo(() => {
    const rows: ({ _header: string } | Note[])[] = [];
    if (pinned.length > 0) rows.push({ _header: "Pinned" });
    rows.push(...columns(pinned));
    if (pinned.length > 0 && others.length > 0) rows.push({ _header: "Others" });
    rows.push(...columns(others));
    return rows;
  }, [pinned, others, columns]);

  const renderTagItem = useCallback(({ item: t }: { item: string }) => {
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
  }, [activeTag]);

  const renderNoteItem = useCallback(({ item }: { item: { _header: string } | Note[] }) => {
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
  }, [renderCard]);

  const renderInboxItem = useCallback(({ item }: { item: InboxItem }) => {
    const checked = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() => {
          if (selecting) return;
          setSheetItem(item); setShowItemSheet(true);
        }}
        onPress={() => {
          if (selecting) { toggleSelect(item.id); return; }
          if (!item.read) markRead(item.id);
        }}
      >
        <Card variant="elevated" className={`mb-2.5 ${!item.read ? "border-l-[3px] border-l-black" : ""}`}>
          <View className="flex-row items-start gap-3">
            {selecting && (
              <View className={`w-6 h-6 rounded-md border-2 items-center justify-center mt-1.5 ${checked ? "bg-black border-black" : "border-ink-300"}`}>
                {checked && <Feather name="check" size={14} color="#ffffff" />}
              </View>
            )}
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
    );
  }, [markRead, selecting, selectedIds, toggleSelect]);

  const handleClearConfirm = useCallback(() => setShowClearConfirm(true), []);

  const sheetTitle = sheetItem?.title;
  const sheetBody = sheetItem?.body;

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
          ) : selecting ? (
            <TouchableOpacity onPress={() => setSelecting(false)}>
              <Text className="text-sm font-medium text-ink-500">Cancel</Text>
            </TouchableOpacity>
          ) : (
            items.length > 0 && (
              <IconButton icon="check-square" onPress={() => setSelecting(true)} />
            )
          )}
        </View>
      </View>

      <View className="mx-4 mb-3">
        <SegmentedControl
          options={[
            { label: "Notes", value: "notes" },
            { label: "Inbox", value: "inbox" },
          ]}
          value={tab}
          onChange={(v) => setTab(v)}
        />
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
                removeClippedSubviews
                maxToRenderPerBatch={10}
                windowSize={5}
                renderItem={renderTagItem}
              />
            </View>
          )}

          {hasNotes ? (
            <FlatList
              data={noteListData}
              keyExtractor={(row, i) => ("_header" in row ? `h-${row._header}` : `row-${i}-${row[0]?.id}`)}
              contentContainerClassName="px-2.5 pb-8"
              removeClippedSubviews
              maxToRenderPerBatch={8}
              windowSize={5}
              renderItem={renderNoteItem}
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
          <View className="flex-row px-4 gap-2 mb-2">
            {FILTERS.map((f) => (
              <Chip
                key={f}
                label={f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                active={localFilter === f}
                onPress={() => setLocalFilter(f)}
              />
            ))}
          </View>

          {selecting && (
            <View className="flex-row items-center justify-between px-4 py-2 mb-2 bg-ink-50 mx-4 rounded-xl">
              <Text className="text-xs font-medium text-ink-600">{selectedIds.size} selected</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={selectAll}
                  className="px-3 py-1.5 bg-white rounded-lg border border-ink-200"
                >
                  <Text className="text-xs font-medium text-ink-600">Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={markSelectedRead}
                  className="px-3 py-1.5 bg-white rounded-lg border border-ink-200"
                >
                  <Text className="text-xs font-medium text-ink-600">Mark Read</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { deleteSelected(); }}
                  className="px-3 py-1.5 bg-white rounded-lg border border-danger"
                >
                  <Text className="text-xs font-medium text-danger">Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const selected = items.filter((i) => selectedIds.has(i.id));
                    const content = selected.map((i) => `[${i.source}] ${i.title}${i.body ? ": " + i.body : ""}`).join("\n");
                    addMessage({
                      id: uid("inbox-msg"),
                      role: "user",
                      content: `From my inbox:\n${content}\n\nAdd these to my schedule where appropriate.`,
                      timestamp: new Date().toISOString(),
                    });
                    setSelecting(false);
                    router.push("/agent");
                  }}
                  className="px-3 py-1.5 bg-black rounded-lg"
                >
                  <Text className="text-xs font-medium text-white">Send to AI</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <FlatList
            data={inboxFiltered}
            keyExtractor={(item) => item.id}
            contentContainerClassName="px-4 pb-8"
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={10}
            renderItem={renderInboxItem}
            ListEmptyComponent={
              <EmptyState icon="inbox" title="No messages yet" subtitle="Notifications, emails, and chats appear here" />
            }
          />
        </>
      )}

      <SheetModal
        visible={showItemSheet && sheetItem !== null}
        onClose={() => { setShowItemSheet(false); setSheetItem(null); }}
        title={sheetTitle}
        message={sheetBody}
        options={[
          { icon: "cpu", label: "Send to AI", onPress: () => {
            if (!sheetItem) return;
            addMessage({
              id: uid("inbox-msg"),
              role: "user",
              content: `From my inbox (${sheetItem.source}): ${sheetItem.title}${sheetItem.body ? " - " + sheetItem.body : ""}\n\nAdd this to my schedule if relevant.`,
              timestamp: new Date().toISOString(),
            });
            setShowItemSheet(false);
            setSheetItem(null);
            router.push("/agent");
          }},
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
          { icon: "youtube", label: "YouTube Summary", onPress: () => router.push({ pathname: "/note", params: { action: "youtube" } }) },
        ]}
      />
    </View>
  );
}

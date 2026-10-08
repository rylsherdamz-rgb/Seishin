import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useNotesStore, Note } from "@/stores/notes-store";
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { useAgentStore, AgentMessage } from "@/stores/agent-store";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetModal } from "@/components/ui/SheetModal";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import Feather from "@expo/vector-icons/Feather";
import { uid } from "@/utils/id";
import { useColors } from "@/theme/ThemeProvider";
import { NoteCard } from "@/components/notes/NoteCard";
import { InboxRow } from "@/components/notes/InboxRow";
import { Fab } from "@/components/ui/Fab";

const FILTERS = ["all", "notification", "email", "chat"] as const;
// Only the first screenful animates in; rows mounted later while scrolling
// (FlatList virtualization) appear instantly instead of replaying animations.
const ANIMATED_ROWS = 6;

export default function NotesScreen() {
  const T = useColors();
  const insets = useSafeAreaInsets();
  // Clearance so list content / toolbars never hide behind the FAB, tab bar,
  // or the device home indicator in the safe-area.
  const bottomGap = insets.bottom + 96;
  const notes = useNotesStore((s) => s.notes);
  const query = useNotesStore((s) => s.query);
  const loadNotes = useNotesStore((s) => s.loadNotes);
  const setQuery = useNotesStore((s) => s.setQuery);
  const items = useInboxStore((s) => s.items);
  const loadItems = useInboxStore((s) => s.loadItems);
  const markRead = useInboxStore((s) => s.markRead);
  const deleteItem = useInboxStore((s) => s.deleteItem);
  const clearAll = useInboxStore((s) => s.clearAll);
  const selectedIds = useInboxStore((s) => s.selectedIds);
  const selecting = useInboxStore((s) => s.selecting);
  const toggleSelect = useInboxStore((s) => s.toggleSelect);
  const selectAll = useInboxStore((s) => s.selectAll);
  const clearSelection = useInboxStore((s) => s.clearSelection);
  const setSelecting = useInboxStore((s) => s.setSelecting);
  const deleteSelected = useInboxStore((s) => s.deleteSelected);
  const markSelectedRead = useInboxStore((s) => s.markSelectedRead);
  const addEvent = useCalendarStore((s) => s.addEvent);
  const addMessage = useAgentStore((s) => s.addMessage);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tab, setTab] = useState<"notes" | "inbox">("notes");
  const [localFilter, setLocalFilter] = useState<string>("all");
  const [showItemSheet, setShowItemSheet] = useState(false);
  const [sheetItem, setSheetItem] = useState<InboxItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showNewNoteSheet, setShowNewNoteSheet] = useState(false);

  useEffect(() => { loadNotes(); loadItems(); }, [loadNotes, loadItems]);

  // Typing updates `query` immediately; filtering follows on a deferred value
  // so the input never waits on a large notebook re-filter.
  const deferredQuery = useDeferredValue(query);
  const filteredNotes = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (activeTag && !n.tags.includes(activeTag)) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [notes, activeTag, deferredQuery]);

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

  // The "+" FAB opens a bottom sheet offering a blank note or an attachment
  // shortcut (camera / photo / file / YouTube), each launching the editor with
  // the matching action.
  const onAddPress = useCallback(() => setShowNewNoteSheet(true), []);

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
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        className={`h-9 px-4 rounded-full items-center justify-center ${active ? "bg-black" : "bg-ink-50"}`}
      >
        <Text className={`text-xs font-bold ${active ? "text-white" : "text-ink-600"}`}>
          {t === "all" ? "All" : `#${t}`}
        </Text>
      </TouchableOpacity>
    );
  }, [activeTag]);

  const renderNoteItem = useCallback(({ item, index }: { item: { _header: string } | Note[]; index: number }) => {
    const content = "_header" in item ? (
      <Text className="text-[11px] font-extrabold text-ink-400 tracking-widest px-2 pt-3 pb-1">
        {item._header.toUpperCase()}
      </Text>
    ) : (
      <View className="flex-row items-start">
        {item.map((n) => <NoteCard key={n.id} note={n} onOpen={openNote} />)}
        {item.length === 1 && <View className="flex-1 m-1.5" />}
      </View>
    );
    if (index >= ANIMATED_ROWS) return content;
    return <Animated.View entering={FadeInDown.delay(index * 40).duration(260)}>{content}</Animated.View>;
  }, [openNote]);

  const onInboxPress = useCallback((item: InboxItem) => {
    if (useInboxStore.getState().selecting) { toggleSelect(item.id); return; }
    if (!item.read) markRead(item.id);
  }, [toggleSelect, markRead]);

  const onInboxLongPress = useCallback((item: InboxItem) => {
    if (useInboxStore.getState().selecting) return;
    setSheetItem(item);
    setShowItemSheet(true);
  }, []);

  const renderInboxItem = useCallback(({ item }: { item: InboxItem }) => (
    <InboxRow
      item={item}
      selecting={selecting}
      checked={selectedIds.has(item.id)}
      onPress={onInboxPress}
      onLongPress={onInboxLongPress}
    />
  ), [selecting, selectedIds, onInboxPress, onInboxLongPress]);

  const unreadCount = useMemo(() => items.reduce((n, i) => n + (i.read ? 0 : 1), 0), [items]);

  const handleClearConfirm = useCallback(() => setShowClearConfirm(true), []);

  const sheetTitle = sheetItem?.title;
  const sheetBody = sheetItem?.body;

  return (
    <View className="flex-1 bg-white">
      <View className="px-5 pt-4 pb-3 flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[30px] font-extrabold tracking-tightest text-black">
            {tab === "notes" ? "Notes" : "Inbox"}
          </Text>
          <Text className="text-[13px] font-semibold text-ink-500 mt-0.5">
            {tab === "notes"
              ? `${notes.length} note${notes.length === 1 ? "" : "s"}`
              : `${unreadCount} unread · ${items.length} total`}
          </Text>
        </View>
        {tab === "inbox" && items.length > 0 ? (
          selecting ? (
            <TouchableOpacity onPress={() => setSelecting(false)} className="h-11 px-2 justify-center" accessibilityRole="button">
              <Text className="text-sm font-bold text-ink-500">Cancel</Text>
            </TouchableOpacity>
          ) : (
            <IconButton icon="check-square" size="md" onPress={() => setSelecting(true)} />
          )
        ) : null}
      </View>

      <View className="mx-5 mb-3">
        <SegmentedControl
          options={[
            { label: "Notes", value: "notes" },
            { label: unreadCount > 0 ? `Inbox · ${unreadCount}` : "Inbox", value: "inbox" },
          ]}
          value={tab}
          onChange={(v) => setTab(v)}
        />
      </View>

      {tab === "notes" ? (
        <>
          <View className="mx-5 mb-3 h-12 bg-ink-50 rounded-2xl px-4 flex-row items-center gap-2.5">
            <Feather name="search" size={15} color={T.ink300} />
            <TextInput
              className="flex-1 text-sm text-black"
              placeholder="Search notes and tags"
              accessibilityLabel="Search notes"
              placeholderTextColor={T.ink300}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Feather name="x-circle" size={15} color={T.ink200} />
              </TouchableOpacity>
            )}
          </View>

          {allTags.length > 0 && (
            <View className="mb-2">
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                bounces
                data={["all", ...allTags]}
                keyExtractor={(t) => t}
                contentContainerClassName="px-5 gap-2"
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
              contentContainerClassName="px-2.5"
              contentContainerStyle={{ paddingBottom: bottomGap }}
              alwaysBounceVertical
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
            contentContainerClassName="px-5"
            contentContainerStyle={{ paddingBottom: bottomGap }}
            alwaysBounceVertical
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



      {tab === "notes" && <Fab label="New note" icon="edit-3" onPress={onAddPress} />}

      <SheetModal
        visible={showItemSheet && sheetItem !== null}
        onClose={() => { setShowItemSheet(false); setSheetItem(null); }}
        title={sheetTitle}
        message={sheetBody}
        options={[
          ...(sheetItem?.pendingEvent ? [{
            icon: "calendar" as const, label: "Add to Calendar", onPress: () => {
              if (!sheetItem?.pendingEvent) return;
              addEvent({
                id: uid("inbox-evt"),
                title: sheetItem.pendingEvent.title,
                startDate: sheetItem.pendingEvent.startDate,
                endDate: sheetItem.pendingEvent.endDate,
                description: sheetItem.pendingEvent.description,
                source: "notification" as const,
              });
              markRead(sheetItem.id);
              setShowItemSheet(false);
              setSheetItem(null);
            },
          }] : []),
          {
            icon: "cpu", label: "Send to AI", onPress: () => {
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
            }
          },
          { icon: "check-circle", label: "Mark Read", onPress: () => { if (sheetItem) markRead(sheetItem.id); } },
          { icon: "trash-2", label: "Delete", destructive: true, onPress: () => { if (sheetItem) deleteItem(sheetItem.id); } },
        ]}
      />
      <AlertDialog
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

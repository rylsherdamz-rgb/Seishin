import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { View, Text, TouchableOpacity, FlatList, ScrollView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useNotesStore, Note } from "@/stores/notes-store";
import { settingsStorage } from "@/stores/mmkv";
import { useInboxStore, InboxItem } from "@/stores/inbox-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { useAgentStore, AgentMessage } from "@/stores/agent-store";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetModal } from "@/components/ui/SheetModal";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import Feather from "@expo/vector-icons/Feather";
import { uid } from "@/utils/id";
import { useColors } from "@/theme/ThemeProvider";
import { NoteCard } from "@/components/notes/NoteCard";
import { InboxRow } from "@/components/notes/InboxRow";
import { NotesSearchBar } from "@/components/notes/NotesSearchBar";
import { NoteActionsSheet } from "@/components/notes/NoteActionsSheet";
import { Fab } from "@/components/ui/Fab";

const FILTERS = ["all", "notification", "email", "chat"] as const;
const LAYOUT_KEY = "settings:notes:layout";

type NoteRow =
  | { kind: "header"; id: string; label: string }
  | { kind: "note"; id: string; note: Note };

function readLayout(): "grid" | "list" {
  try {
    return settingsStorage.getString(LAYOUT_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/** Material 3 filter chip: outlined when off, tonal with a check when on. */
function FilterChip({ label, icon, selected, onPress }: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  selected: boolean;
  onPress: () => void;
}) {
  const T = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-1.5 h-9 px-3.5 rounded-lg border ${selected ? "bg-accent/15 border-transparent" : "border-ink-150"}`}
    >
      <Feather name={selected ? "check" : icon} size={14} color={selected ? T.black : T.ink600} />
      <Text className={`text-[13px] font-semibold ${selected ? "text-black" : "text-ink-700"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function NotesScreen() {
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
  const [actionNote, setActionNote] = useState<Note | null>(null);
  const [layout, setLayout] = useState<"grid" | "list">(readLayout);
  const toggleLayout = useCallback(() => {
    setLayout((l) => {
      const next = l === "grid" ? "list" : "grid";
      try { settingsStorage.set(LAYOUT_KEY, next); } catch { /* view still switches */ }
      return next;
    });
  }, []);

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

  const hasNotes = pinned.length + others.length > 0;

  // One flat list for the masonry grid: section headers span every column.
  const noteListData = useMemo<NoteRow[]>(() => {
    const rows: NoteRow[] = [];
    if (pinned.length > 0) rows.push({ kind: "header", id: "h-pinned", label: "PINNED" });
    for (const n of pinned) rows.push({ kind: "note", id: n.id, note: n });
    if (pinned.length > 0 && others.length > 0) rows.push({ kind: "header", id: "h-others", label: "OTHERS" });
    for (const n of others) rows.push({ kind: "note", id: n.id, note: n });
    return rows;
  }, [pinned, others]);

  const compact = layout === "grid";
  const renderNoteItem = useCallback(({ item }: { item: NoteRow }) =>
    item.kind === "header" ? (
      <Text className="text-[11px] font-bold text-ink-600 tracking-widest px-3 pt-4 pb-1.5">{item.label}</Text>
    ) : (
      <NoteCard note={item.note} compact={compact} onOpen={openNote} onLongPress={setActionNote} />
    ), [compact, openNote]);

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
      <View className="pt-3 pb-2 gap-3">
        {tab === "notes" ? (
          <NotesSearchBar value={query} onChange={setQuery} layout={layout} onToggleLayout={toggleLayout} />
        ) : (
          <View className="mx-5 h-14 flex-row items-center justify-between">
            <View>
              <Text className="text-[22px] font-bold text-black">Inbox</Text>
              <Text className="text-xs font-medium text-ink-500">{unreadCount} unread · {items.length} total</Text>
            </View>
            {items.length > 0 ? (
              selecting ? (
                <TouchableOpacity onPress={() => setSelecting(false)} className="h-11 px-2 justify-center" accessibilityRole="button">
                  <Text className="text-sm font-bold text-ink-600">Cancel</Text>
                </TouchableOpacity>
              ) : (
                <IconButton icon="check-square" size="md" variant="plain" onPress={() => setSelecting(true)} />
              )
            ) : null}
          </View>
        )}

        {/* Filter chips: section switch first, then the notebook's labels. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-4 gap-2 items-center"
        >
          <FilterChip label="Notes" icon="file-text" selected={tab === "notes" && !activeTag} onPress={() => { setTab("notes"); setActiveTag(null); }} />
          <FilterChip label={unreadCount > 0 ? `Inbox  ${unreadCount}` : "Inbox"} icon="inbox" selected={tab === "inbox"} onPress={() => setTab("inbox")} />
          {tab === "notes" && allTags.length > 0 ? <View className="w-px h-6 bg-ink-150 mx-1" /> : null}
          {tab === "notes" && allTags.map((t) => (
            <FilterChip key={t} label={t} icon="tag" selected={activeTag === t} onPress={() => setActiveTag(activeTag === t ? null : t)} />
          ))}
        </ScrollView>
      </View>

      {tab === "notes" ? (
        hasNotes ? (
          <FlashList
            key={layout}
            data={noteListData}
            masonry
            numColumns={layout === "grid" ? 2 : 1}
            keyExtractor={(r) => r.id}
            getItemType={(r) => r.kind}
            overrideItemLayout={(l, item, _i, maxColumns) => { if (item.kind === "header") l.span = maxColumns; }}
            renderItem={renderNoteItem}
            contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: bottomGap }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <EmptyState
            icon={query || activeTag ? "search" : "file-text"}
            title={query || activeTag ? "No matching notes" : "Notes you add appear here"}
            subtitle={query || activeTag ? "Try a different search or label" : "Tap the pencil to write, snap a photo, or summarize a video"}
          />
        )
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
      {actionNote && <NoteActionsSheet note={actionNote} onClose={() => setActionNote(null)} />}

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
        title="New note"
        message="Start writing, or begin with a photo, file or video"
        options={[
          { icon: "zap", label: "Smart capture (assignment, notice…)", onPress: () => router.push("/capture") },
          { icon: "file-text", label: "Text note", onPress: () => openNote() },
          { icon: "camera", label: "Take photo", onPress: () => router.push({ pathname: "/note", params: { action: "camera" } }) },
          { icon: "image", label: "Choose photo", onPress: () => router.push({ pathname: "/note", params: { action: "photo" } }) },
          { icon: "paperclip", label: "Attach file", onPress: () => router.push({ pathname: "/note", params: { action: "file" } }) },
          { icon: "youtube", label: "Summarize a YouTube video", onPress: () => router.push({ pathname: "/note", params: { action: "youtube" } }) },
        ]}
      />
    </View>
  );
}

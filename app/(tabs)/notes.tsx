import { useState, useEffect, useCallback, useMemo, useDeferredValue } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useNotesStore, Note } from "@/stores/notes-store";
import { settingsStorage } from "@/stores/mmkv";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetModal } from "@/components/ui/SheetModal";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { NoteCard } from "@/components/notes/NoteCard";
import { NotesSearchBar } from "@/components/notes/NotesSearchBar";
import { NoteActionsSheet } from "@/components/notes/NoteActionsSheet";
import { Fab } from "@/components/ui/Fab";

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
  const [activeTag, setActiveTag] = useState<string | null>(null);
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

  useEffect(() => { loadNotes(); }, [loadNotes]);

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

  return (
    <View className="flex-1 bg-white">
      <View className="pt-3 pb-2 gap-3">
        <NotesSearchBar value={query} onChange={setQuery} layout={layout} onToggleLayout={toggleLayout} />

        {/* Label filter: only when the notebook has labels. */}
        {allTags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerClassName="px-4 gap-2 items-center"
          >
            <FilterChip label="All" icon="file-text" selected={!activeTag} onPress={() => setActiveTag(null)} />
            {allTags.map((t) => (
              <FilterChip key={t} label={t} icon="tag" selected={activeTag === t} onPress={() => setActiveTag(activeTag === t ? null : t)} />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {hasNotes ? (
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
      )}

      <Fab label="New note" icon="edit-3" onPress={onAddPress} />
      {actionNote && <NoteActionsSheet note={actionNote} onClose={() => setActionNote(null)} />}

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

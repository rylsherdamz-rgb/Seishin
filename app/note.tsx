import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { launchCameraAsync, launchImageLibraryAsync } from "expo-image-picker";
import { getDocumentAsync } from "expo-document-picker";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNotesStore, NoteAttachment } from "@/stores/notes-store";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { recognizeText } from "@/services/ocr";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { SheetModal } from "@/components/ui/SheetModal";
import { EditorBottomBar } from "@/components/notes/EditorBottomBar";
import { EditorImages, EditorFiles } from "@/components/notes/EditorAttachments";
import { NoteColorPicker } from "@/components/notes/NoteColorPicker";
import { uid } from "@/utils/id";
import { extractVideoId, getTranscript, summarizeTranscript, downloadThumbnail } from "@/services/youtube-summary";
import { useTheme } from "@/theme/ThemeProvider";
import { isNoteColorId, noteBackground, type NoteColorId } from "@/theme/note-colors";

/** Height of the bottom app bar (excluding the safe-area inset). */
const BAR_H = 56;

function editedLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return `Edited ${sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

type Draft = { title: string; body: string; tags: string[]; pinned: boolean; attachments: NoteAttachment[]; color: NoteColorId };

export default function NoteEditorScreen() {
  const { colors: T, dark } = useTheme();
  const { id, eventId, action } = useLocalSearchParams<{ id?: string; eventId?: string; action?: string }>();
  const addNote = useNotesStore((s) => s.addNote);
  const updateNote = useNotesStore((s) => s.updateNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);
  // Read once: subscribing to the whole notes array would re-render the editor
  // on every save of this very note.
  const [existing] = useState(() => {
    if (!id) return undefined;
    const store = useNotesStore.getState();
    // Opened from elsewhere (e.g. a calendar event) before the Notes tab ever
    // loaded the notebook: hydrate it first.
    if (store.notes.length === 0) store.loadNotes();
    return useNotesStore.getState().notes.find((n) => n.id === id);
  });

  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [attachments, setAttachments] = useState<NoteAttachment[]>(existing?.attachments ?? []);
  const [color, setColor] = useState<NoteColorId>(isNoteColorId(existing?.color) ? existing.color : "default");
  const [lastEdited, setLastEdited] = useState<string | null>(existing?.updatedAt ?? null);
  const [tagInput, setTagInput] = useState("");
  const [labelEditing, setLabelEditing] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addSheet, setAddSheet] = useState(false);
  const [moreSheet, setMoreSheet] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFileError, setShowFileError] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeBusy, setYoutubeBusy] = useState(false);
  const insets = useSafeAreaInsets();
  const { inset: kb, top: kbTop } = useKeyboardInset();
  const youtubeSnapPoints = useMemo(() => ["40%"], []);
  const noteIdRef = useRef<string | undefined>(existing?.id);
  // Ensures a launch "action" (from the Notes "+" menu) fires its picker only once.
  const actionFired = useRef(false);
  const background = noteBackground(color, dark) ?? T.white;

  // — Keyboard-aware scrolling ———————————————————————————————————————
  // The layout itself ends at the keyboard (spacer below the bottom bar), so
  // nothing is ever drawn underneath it. These refs keep the caret visible:
  // the line you tapped scrolls above the keyboard when it opens, and text
  // typed at the end of the note keeps following the caret.
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const touchY = useRef<number | null>(null);
  const followEnd = useRef(false);

  const onEditorTouch = useCallback((e: GestureResponderEvent) => { touchY.current = e.nativeEvent.pageY; }, []);

  useEffect(() => {
    if (kb === 0 || touchY.current === null) return;
    const visibleBottom = kbTop - BAR_H - 40;
    const overflow = touchY.current - visibleBottom;
    if (overflow <= 0) return;
    const raf = requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: scrollY.current + overflow, animated: true }));
    return () => cancelAnimationFrame(raf);
  }, [kb, kbTop]);

  const onContentSizeChange = useCallback(() => {
    if (followEnd.current && kb > 0) scrollRef.current?.scrollToEnd({ animated: false });
  }, [kb]);

  // When opened from the Notes "+" menu with an action, immediately launch the
  // matching picker (camera / gallery / file) once for this fresh note.
  useEffect(() => {
    if (actionFired.current || existing || !action) return;
    actionFired.current = true;
    if (action === "camera") addPhoto(true);
    else if (action === "photo") addPhoto(false);
    else if (action === "file") addFile();
    else if (action === "ocr") scanOnly();
    else if (action === "youtube") setShowYoutubeInput(true);
  }, [action]);

  // True while there are edits not yet written; the exit flush only saves
  // then, so merely viewing a note never bumps its updatedAt.
  const dirtyRef = useRef(false);
  const persist = useCallback((next?: Partial<Draft>) => {
    const t = next?.title ?? title;
    const b = next?.body ?? body;
    const tg = next?.tags ?? tags;
    const p = next?.pinned ?? pinned;
    const at = next?.attachments ?? attachments;
    const c = next?.color ?? color;
    dirtyRef.current = false;
    // Don't create empty notes (no text, tags, or attachments).
    if (!t.trim() && !b.trim() && tg.length === 0 && at.length === 0) return;
    const fields = { title: t, body: b, tags: tg, pinned: p, attachments: at, color: c === "default" ? undefined : c };

    if (noteIdRef.current) {
      updateNote(noteIdRef.current, fields);
    } else {
      const newId = uid("note");
      noteIdRef.current = newId;
      const now = new Date().toISOString();
      addNote({
        id: newId,
        ...fields,
        eventId: typeof eventId === "string" ? eventId : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
    setLastEdited(new Date().toISOString());
  }, [title, body, tags, pinned, attachments, color, eventId]);

  // Autosave edits (skip the initial mount so opening an existing note doesn't
  // bump its updatedAt). Debounced: a save re-sorts and serializes every note,
  // so doing it per keystroke made typing lag on large notebooks. Unmount
  // flushes whatever is still pending.
  const mountedOnceRef = useRef(false);
  useEffect(() => {
    if (!mountedOnceRef.current) { mountedOnceRef.current = true; return; }
    dirtyRef.current = true;
    const t = setTimeout(persist, 400);
    return () => clearTimeout(t);
  }, [title, body, tags, pinned, attachments, color, persist]);

  // Flush pending edits on unmount — gesture/system back bypass handleBack.
  const lastPersistRef = useRef<() => void>(() => { });
  lastPersistRef.current = persist;
  useEffect(() => {
    return () => { if (dirtyRef.current) lastPersistRef.current(); };
  }, []);

  const handleBack = useCallback(() => {
    if (dirtyRef.current) persist();
    router.back();
  }, [persist]);

  const togglePin = useCallback(() => {
    const next = !pinned;
    setPinned(next);
    persist({ pinned: next });
  }, [pinned, persist]);

  const changeColor = useCallback((c: NoteColorId) => {
    setColor(c);
    persist({ color: c });
  }, [persist]);

  const addTag = useCallback(() => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase().slice(0, 40);
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    const next = [...tags, t];
    setTags(next);
    setTagInput("");
    persist({ tags: next });
  }, [tagInput, tags, persist]);

  const removeTag = useCallback((t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    persist({ tags: next });
  }, [tags, persist]);

  const removeAttachment = useCallback((attId: string) => {
    const next = attachments.filter((a) => a.id !== attId);
    setAttachments(next);
    persist({ attachments: next });
  }, [attachments, persist]);

  const makeCopy = useCallback(() => {
    const now = new Date().toISOString();
    const copyId = uid("note");
    addNote({
      id: copyId, title: title ? `${title} (copy)` : "", body, tags, pinned: false, attachments,
      color: color === "default" ? undefined : color, createdAt: now, updatedAt: now,
    });
    router.replace({ pathname: "/note", params: { id: copyId } });
  }, [title, body, tags, attachments, color, addNote]);

  // Append OCR-extracted text to the note body under a labeled divider so
  // scanned content becomes part of the note (the "highlighted note").
  const runOcrIntoBody = useCallback(async (imageUri: string) => {
    setOcrBusy(true);
    try {
      const text = (await recognizeText(imageUri)).trim();
      if (text) {
        const block = `\n\n— Scanned text —\n${text}`;
        const nextBody = (body ? body : "").concat(block).replace(/^\n+/, "");
        setBody(nextBody);
        persist({ body: nextBody });
      }
    } catch {
      // OCR is best-effort; nothing is attached when scanning text only.
      Alert.alert("Scan failed", "Couldn't read text from that image.");
    } finally {
      setOcrBusy(false);
    }
  }, [body, persist]);

  const scanOnly = useCallback(async () => {
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      runOcrIntoBody(result.assets[0].uri);
    } catch {
      Alert.alert("Picker failed", "Could not open the photo picker. Check app permissions and try again.");
    }
  }, [runOcrIntoBody]);

  const fetchYoutubeTranscript = useCallback(async () => {
    const vid = extractVideoId(youtubeUrl.trim());
    if (!vid) {
      Alert.alert("Invalid URL", "Please enter a valid YouTube video URL (e.g. https://youtube.com/watch?v=...)");
      return;
    }
    setYoutubeBusy(true);
    try {
      const { segments, videoInfo } = await getTranscript(vid);
      const summary = await summarizeTranscript(videoInfo, segments);
      const t = videoInfo.title;
      setTitle(t);
      const nextBody = (body ? body + "\n\n" : "") + summary;
      setBody(nextBody);

      const thumbUri = await downloadThumbnail(videoInfo);
      const nextAtts = [...attachments];
      if (thumbUri) {
        nextAtts.push({
          id: uid(),
          type: "image" as const,
          uri: thumbUri,
          name: "YouTube thumbnail",
        });
      }

      persist({ title: t, body: nextBody, attachments: nextAtts });
      setAttachments(nextAtts);
      setShowYoutubeInput(false);
      setYoutubeUrl("");
    } catch (e: any) {
      Alert.alert("Transcript Error", e.message || "Could not fetch transcript for this video.");
    } finally {
      setYoutubeBusy(false);
    }
  }, [youtubeUrl, body, title, attachments, persist]);

  const addPhoto = useCallback(async (fromCamera: boolean) => {
    const picker = fromCamera ? launchCameraAsync : launchImageLibraryAsync;
    try {
      const result = await picker({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const att: NoteAttachment = {
        id: uid("att"),
        type: "image",
        uri: asset.uri,
        name: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? "image/*",
        size: asset.fileSize,
      };
      const next = [...attachments, att];
      setAttachments(next);
      persist({ attachments: next });
    } catch {
      Alert.alert(
        fromCamera ? "Camera unavailable" : "Photo unavailable",
        "Could not open the picker. Check app permissions and try again."
      );
    }
  }, [attachments, persist]);

  const addFile = useCallback(async () => {
    try {
      const result = await getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets[0]) return;
      const file = result.assets[0];
      const isImage = (file.mimeType ?? "").startsWith("image/");
      const att: NoteAttachment = {
        id: uid("att"),
        type: isImage ? "image" : "file",
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType ?? undefined,
        size: file.size ?? undefined,
      };
      const next = [...attachments, att];
      setAttachments(next);
      persist({ attachments: next });
    } catch {
      setShowFileError(true);
    }
  }, [attachments, persist]);

  const imageAtts = useMemo(() => attachments.filter((a) => a.type === "image"), [attachments]);
  const fileAtts = useMemo(() => attachments.filter((a) => a.type === "file"), [attachments]);

  return (
    <View className="flex-1" style={{ backgroundColor: background }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top app bar — plain icon buttons, Material 3 style. */}
      <View className="flex-row items-center justify-between px-1 h-14">
        <TouchableOpacity onPress={handleBack} accessibilityRole="button" accessibilityLabel="Back" className="w-12 h-12 rounded-full items-center justify-center">
          <Feather name="arrow-left" size={22} color={T.ink800} />
        </TouchableOpacity>
        <View className="flex-row items-center">
          {ocrBusy && <ActivityIndicator size="small" color={T.ink500} style={{ marginRight: 8 }} />}
          <TouchableOpacity
            onPress={togglePin}
            accessibilityRole="button"
            accessibilityLabel={pinned ? "Unpin note" : "Pin note"}
            accessibilityState={{ selected: pinned }}
            className="w-12 h-12 rounded-full items-center justify-center"
          >
            <Ionicons name={pinned ? "pin" : "pin-outline"} size={22} color={T.ink800} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={32}
        onContentSizeChange={onContentSizeChange}
        onTouchStart={onEditorTouch}
      >
        <EditorImages images={imageAtts} onRemove={removeAttachment} />

        <View className="px-5 pt-2 flex-1">
          {eventId ? (
            <View className="flex-row items-center gap-1.5 self-start mb-2 px-3 h-8 rounded-full border border-ink-150">
              <Feather name="calendar" size={12} color={T.ink700} />
              <Text className="text-xs font-semibold text-ink-700">Linked to event</Text>
            </View>
          ) : null}
          <TextInput
            className="text-[22px] font-semibold text-black py-2"
            placeholder="Title"
            placeholderTextColor={T.ink400}
            value={title}
            onChangeText={setTitle}
            onFocus={() => { followEnd.current = false; }}
            multiline
            maxLength={200}
            accessibilityLabel="Title"
          />
          <TextInput
            className="text-base leading-6 text-ink-900 pt-1 flex-1 min-h-[200px]"
            placeholder="Note"
            placeholderTextColor={T.ink400}
            value={body}
            onChangeText={setBody}
            onSelectionChange={(e) => { followEnd.current = e.nativeEvent.selection.end >= body.length - 1; }}
            onBlur={() => { followEnd.current = false; }}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            autoFocus={!existing && !action}
            accessibilityLabel="Note"
          />

          <EditorFiles files={fileAtts} onRemove={removeAttachment} />

          {tags.length > 0 || labelEditing ? (
            <View className="flex-row flex-wrap items-center gap-2 mt-4">
              {tags.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => removeTag(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove label ${t}`}
                  className="flex-row items-center gap-1 h-8 pl-3 pr-2 rounded-lg bg-black/5"
                >
                  <Text className="text-[13px] font-medium text-ink-800">{t}</Text>
                  <Feather name="x" size={13} color={T.ink500} />
                </TouchableOpacity>
              ))}
              {labelEditing ? (
                <View className="flex-row items-center h-8 px-3 rounded-lg border border-ink-200 min-w-[140px]">
                  <Feather name="tag" size={13} color={T.ink500} />
                  <TextInput
                    className="flex-1 text-[13px] text-black ml-1.5 py-0"
                    placeholder="Label name"
                    placeholderTextColor={T.ink400}
                    value={tagInput}
                    onChangeText={setTagInput}
                    onSubmitEditing={addTag}
                    onFocus={() => { followEnd.current = true; }}
                    onBlur={() => { addTag(); setLabelEditing(false); }}
                    autoFocus
                    autoCapitalize="none"
                    returnKeyType="done"
                    blurOnSubmit={false}
                    accessibilityLabel="New label"
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {paletteOpen ? (
        <View className="border-t border-ink-75" style={{ backgroundColor: background }}>
          <NoteColorPicker value={color} onChange={changeColor} />
        </View>
      ) : null}

      <EditorBottomBar
        editedLabel={editedLabel(lastEdited)}
        paletteOpen={paletteOpen}
        onAdd={() => setAddSheet(true)}
        onTogglePalette={() => setPaletteOpen((v) => !v)}
        onMore={() => setMoreSheet(true)}
        background={background}
        bottomInset={kb > 0 ? 0 : insets.bottom}
      />
      {/* Occupies exactly the keyboard's area so the bar sits on top of it. */}
      <View style={{ height: kb }} />

      <SheetModal
        visible={addSheet}
        onClose={() => setAddSheet(false)}
        options={[
          { icon: "camera", label: "Take photo", onPress: () => addPhoto(true) },
          { icon: "image", label: "Add image", onPress: () => addPhoto(false) },
          { icon: "maximize", label: "Scan text from image", onPress: scanOnly },
          { icon: "paperclip", label: "Attach file", onPress: addFile },
          { icon: "youtube", label: "Summarize a YouTube video", onPress: () => setShowYoutubeInput(true) },
        ]}
      />
      <SheetModal
        visible={moreSheet}
        onClose={() => setMoreSheet(false)}
        options={[
          { icon: "tag", label: "Add label", onPress: () => setLabelEditing(true) },
          { icon: "copy", label: "Make a copy", onPress: makeCopy },
          { icon: "trash-2", label: "Delete", destructive: true, onPress: () => setShowDeleteConfirm(true) },
        ]}
      />
      <BottomSheet
        index={showYoutubeInput || youtubeBusy ? 0 : -1}
        snapPoints={youtubeSnapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: T.white }}
        onChange={(index: number) => { if (index === -1 && !youtubeBusy) { setShowYoutubeInput(false); setYoutubeUrl(""); } }}
      >
        <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 }}>
          <Text className="text-base font-semibold text-black mb-1">YouTube Video Summary</Text>
          <Text className="text-xs text-ink-400 mb-4">Paste a YouTube link to generate a timestamped transcript</Text>
          {youtubeBusy ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={T.black} />
              <Text className="text-sm text-ink-500 mt-3">Fetching transcript and thumbnail...</Text>
            </View>
          ) : (
            <>
              <TextInput
                className="h-11 bg-ink-50 rounded-xl px-4 text-sm text-black mb-4"
                placeholder="https://youtube.com/watch?v=..."
                placeholderTextColor={T.ink300}
                value={youtubeUrl}
                onChangeText={setYoutubeUrl}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={fetchYoutubeTranscript}
              />
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => { setShowYoutubeInput(false); setYoutubeUrl(""); }}
                  className="flex-1 h-11 border border-ink-200 rounded-xl items-center justify-center"
                >
                  <Text className="text-sm font-medium text-black">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={fetchYoutubeTranscript}
                  disabled={!youtubeUrl.trim()}
                  className="flex-1 h-11 bg-black rounded-xl items-center justify-center"
                >
                  <Text className="text-sm font-medium text-white">Generate</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
      <AlertDialog
        visible={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete note"
        message="This note will be permanently removed."
        confirmLabel="Delete"
        confirmDestructive
        onConfirm={() => { if (noteIdRef.current) deleteNote(noteIdRef.current); router.back(); }}
      />
      <AlertDialog
        visible={showFileError}
        onClose={() => setShowFileError(false)}
        title="Could not open file"
        message="This file type is not supported or could not be accessed."
      />
    </View>
  );
}

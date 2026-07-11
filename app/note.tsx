import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { launchCameraAsync, launchImageLibraryAsync } from "expo-image-picker";
import { getDocumentAsync } from "expo-document-picker";
import { useNotesStore, NoteAttachment } from "@/stores/notes-store";
import { recognizeText } from "@/services/ocr";
import { uid } from "@/utils/id";
import Feather from "@expo/vector-icons/Feather";

export default function NoteEditorScreen() {
  const { id, eventId, action } = useLocalSearchParams<{ id?: string; eventId?: string; action?: string }>();
  const { notes, addNote, updateNote, deleteNote } = useNotesStore();
  const existing = id ? notes.find((n) => n.id === id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [attachments, setAttachments] = useState<NoteAttachment[]>(existing?.attachments ?? []);
  const [tagInput, setTagInput] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const noteIdRef = useRef<string | undefined>(existing?.id);
  // Ensures a launch "action" (from the Notes + menu) fires its picker only once.
  const actionFired = useRef(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setBody(existing.body);
      setTags(existing.tags);
      setPinned(existing.pinned);
      setAttachments(existing.attachments ?? []);
      noteIdRef.current = existing.id;
    }
  }, [existing?.id]);

  // When opened from the Notes "+" menu with an action, immediately launch the
  // matching picker (camera / gallery / file) once for this fresh note.
  useEffect(() => {
    if (actionFired.current || existing || !action) return;
    actionFired.current = true;
    if (action === "camera") addPhoto(true);
    else if (action === "photo") addPhoto(false);
    else if (action === "file") addFile();
  }, [action]);

  function persist(next?: Partial<{ title: string; body: string; tags: string[]; pinned: boolean; attachments: NoteAttachment[] }>) {
    const t = next?.title ?? title;
    const b = next?.body ?? body;
    const tg = next?.tags ?? tags;
    const p = next?.pinned ?? pinned;
    const at = next?.attachments ?? attachments;
    // Don't create empty notes (no text, tags, or attachments).
    if (!t.trim() && !b.trim() && tg.length === 0 && at.length === 0) return;

    if (noteIdRef.current) {
      updateNote(noteIdRef.current, { title: t, body: b, tags: tg, pinned: p, attachments: at });
    } else {
      const newId = uid("note");
      noteIdRef.current = newId;
      const now = new Date().toISOString();
      addNote({
        id: newId,
        title: t,
        body: b,
        tags: tg,
        pinned: p,
        attachments: at,
        eventId: typeof eventId === "string" ? eventId : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  function handleBack() {
    persist();
    router.back();
  }

  function togglePin() {
    const next = !pinned;
    setPinned(next);
    persist({ pinned: next });
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!t || tags.includes(t)) { setTagInput(""); return; }
    const next = [...tags, t];
    setTags(next);
    setTagInput("");
    persist({ tags: next });
  }

  function removeTag(t: string) {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    persist({ tags: next });
  }

  function removeAttachment(attId: string) {
    const next = attachments.filter((a) => a.id !== attId);
    setAttachments(next);
    persist({ attachments: next });
  }

  // Append OCR-extracted text to the note body under a labeled divider so
  // scanned content becomes part of the note (the "highlighted note").
  async function runOcrIntoBody(imageUri: string) {
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
      // OCR is best-effort; the image is still attached even if it fails.
    } finally {
      setOcrBusy(false);
    }
  }

  async function addPhoto(fromCamera: boolean) {
    const picker = fromCamera ? launchCameraAsync : launchImageLibraryAsync;
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
    // Best-effort: pull any text out of the photo into the note body.
    runOcrIntoBody(asset.uri);
  }

  async function addFile() {
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
      if (isImage) runOcrIntoBody(file.uri);
    } catch {
      Alert.alert("Error", "Could not open that file.");
    }
  }

  function handleDelete() {
    Alert.alert("Delete note", "This note will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (noteIdRef.current) deleteNote(noteIdRef.current);
          router.back();
        },
      },
    ]);
  }

  const imageAtts = attachments.filter((a) => a.type === "image");
  const fileAtts = attachments.filter((a) => a.type === "file");

  function fmtSize(bytes?: number) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <TouchableOpacity onPress={handleBack} className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
          <Feather name="arrow-left" size={16} color="#000000" />
        </TouchableOpacity>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={togglePin}
            className={`w-9 h-9 rounded-full items-center justify-center ${pinned ? "bg-black" : "bg-ink-100"}`}
          >
            <Feather name="bookmark" size={15} color={pinned ? "#ffffff" : "#000000"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="trash-2" size={15} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
          {eventId && (
            <View className="flex-row items-center gap-1.5 mb-2 self-start px-2.5 py-1 bg-black rounded-full">
              <Feather name="calendar" size={11} color="#ffffff" />
              <Text className="text-[11px] font-semibold text-white">Linked to event</Text>
            </View>
          )}
          <TextInput
            className="text-2xl font-semibold tracking-tight text-black py-2"
            placeholder="Title"
            placeholderTextColor="#cccccc"
            value={title}
            onChangeText={setTitle}
            onBlur={() => persist()}
            multiline
          />
          <TextInput
            className="text-base text-ink-800 leading-6 py-2 min-h-[160px]"
            placeholder="Start writing, or attach a photo/file below…"
            placeholderTextColor="#cccccc"
            value={body}
            onChangeText={setBody}
            onBlur={() => persist()}
            multiline
            textAlignVertical="top"
          />

          {ocrBusy && (
            <View className="flex-row items-center gap-2 mb-3">
              <ActivityIndicator size="small" color="#000000" />
              <Text className="text-xs text-ink-500">Reading text from image…</Text>
            </View>
          )}

          {/* Image attachments */}
          {imageAtts.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-3">
              {imageAtts.map((a) => (
                <View key={a.id} className="relative">
                  <Image source={{ uri: a.uri }} className="w-24 h-24 rounded-card bg-ink-100" resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => removeAttachment(a.id)}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-black rounded-full items-center justify-center border-2 border-white"
                  >
                    <Feather name="x" size={11} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* File attachments */}
          {fileAtts.length > 0 && (
            <View className="gap-2 mb-3">
              {fileAtts.map((a) => (
                <View key={a.id} className="flex-row items-center gap-3 bg-white border border-ink-100 rounded-card p-3 shadow-subtle">
                  <View className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
                    <Feather name="file-text" size={16} color="#000000" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-black font-medium" numberOfLines={1}>{a.name || "File"}</Text>
                    <Text className="text-xs text-ink-300">{[a.mimeType, fmtSize(a.size)].filter(Boolean).join(" · ")}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeAttachment(a.id)} className="w-8 h-8 items-center justify-center">
                    <Feather name="x" size={15} color="#999999" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Attachment toolbar */}
          <View className="flex-row gap-2 mt-1 mb-4">
            <TouchableOpacity onPress={() => addPhoto(true)} className="flex-1 h-11 bg-ink-50 rounded-xl items-center justify-center flex-row gap-1.5">
              <Feather name="camera" size={15} color="#000000" />
              <Text className="text-xs font-semibold text-black">Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => addPhoto(false)} className="flex-1 h-11 bg-ink-50 rounded-xl items-center justify-center flex-row gap-1.5">
              <Feather name="image" size={15} color="#000000" />
              <Text className="text-xs font-semibold text-black">Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addFile} className="flex-1 h-11 bg-ink-50 rounded-xl items-center justify-center flex-row gap-1.5">
              <Feather name="paperclip" size={15} color="#000000" />
              <Text className="text-xs font-semibold text-black">File</Text>
            </TouchableOpacity>
          </View>

          {/* Tags */}
          <View className="flex-row flex-wrap items-center gap-2 mb-2">
            {tags.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => removeTag(t)}
                className="flex-row items-center gap-1 px-3 py-1.5 bg-ink-100 rounded-full"
              >
                <Text className="text-xs font-semibold text-ink-600">#{t}</Text>
                <Feather name="x" size={11} color="#999999" />
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row items-center gap-2 mb-10 h-11 bg-ink-50 rounded-xl px-4">
            <Feather name="tag" size={14} color="#999999" />
            <TextInput
              className="flex-1 text-sm text-black"
              placeholder="Add a tag"
              placeholderTextColor="#999999"
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              autoCapitalize="none"
              returnKeyType="done"
            />
            {tagInput.length > 0 && (
              <TouchableOpacity onPress={addTag}>
                <Feather name="plus-circle" size={16} color="#000000" />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

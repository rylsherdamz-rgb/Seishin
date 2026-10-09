import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { launchCameraAsync, launchImageLibraryAsync } from "expo-image-picker";
import { getDocumentAsync } from "expo-document-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import Feather from "@expo/vector-icons/Feather";
import { recognizeText } from "@/services/ocr";
import { analyzeCapture, type CaptureAnalysis } from "@/services/capture-analyzer";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useColors } from "@/theme/ThemeProvider";
import { Photo } from "@/components/ui/Photo";
import { PickerModal } from "@/components/ui/PickerModal";
import { CaptureReview, type ReviewState } from "@/components/capture/CaptureReview";
import { saveCapture, type CapturedFile } from "@/components/capture/save-capture";

type Phase = "pick" | "reading" | "review";
const MAX_FILES = 10;

function initialReview(a: CaptureAnalysis): ReviewState {
  return {
    kind: a.kind,
    title: a.title,
    subject: a.subject ?? "",
    due: a.due ? new Date(a.due) : null,
    dueHasTime: a.dueHasTime,
    items: a.items,
    reminder: a.kind === "assignment" || a.kind === "exam" ? "persistent" : a.kind === "event" ? "normal" : "off",
  };
}

/**
 * Smart capture: dump photos (camera, gallery, Google Drive / any file app),
 * Seishin reads them, works out what they are and what's due, asks when it's
 * unsure, then saves a task + note and keeps reminding until it's done.
 */
export default function CaptureScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { inset: kb } = useKeyboardInset();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [files, setFiles] = useState<CapturedFile[]>([]);
  const [phase, setPhase] = useState<Phase>("pick");
  const [progress, setProgress] = useState("");
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<CaptureAnalysis | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const launched = useRef(false);

  const addFiles = useCallback((next: CapturedFile[]) => {
    setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
  }, []);

  const fromCamera = useCallback(async () => {
    try {
      const r = await launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
      if (!r.canceled) addFiles(r.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? undefined, mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize })));
    } catch {
      Alert.alert("Camera unavailable", "Allow camera access in system settings, then try again.");
    }
  }, [addFiles]);

  const fromGallery = useCallback(async () => {
    try {
      const r = await launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsMultipleSelection: true, selectionLimit: MAX_FILES });
      if (!r.canceled) addFiles(r.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? undefined, mimeType: a.mimeType ?? "image/jpeg", size: a.fileSize })));
    } catch {
      Alert.alert("Can't open photos", "Allow photo access in system settings, then try again.");
    }
  }, [addFiles]);

  // The system file picker lists Google Drive, OneDrive, Dropbox and any other
  // installed storage provider — no separate sign-in needed.
  const fromFiles = useCallback(async () => {
    try {
      const r = await getDocumentAsync({ type: ["image/*", "application/pdf"], multiple: true, copyToCacheDirectory: true });
      if (!r.canceled) addFiles(r.assets.map((a) => ({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? undefined, size: a.size ?? undefined })));
    } catch {
      Alert.alert("Can't open files", "The file picker couldn't be opened. Please try again.");
    }
  }, [addFiles]);

  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    if (source === "camera") fromCamera();
    else if (source === "photos") fromGallery();
    else if (source === "files") fromFiles();
  }, [source, fromCamera, fromGallery, fromFiles]);

  const analyze = useCallback(async () => {
    setPhase("reading");
    const images = files.filter((f) => (f.mimeType ?? "image/").startsWith("image/"));
    const texts: string[] = [];
    for (let i = 0; i < images.length; i++) {
      setProgress(`Reading photo ${i + 1} of ${images.length}…`);
      try {
        const t = (await recognizeText(images[i].uri)).trim();
        if (t) texts.push(t);
      } catch {
        // Unreadable photo: keep going with the others.
      }
    }
    const joined = texts.join("\n\n");
    setText(joined);
    setProgress("Working out what this is…");
    const a = await analyzeCapture(joined);
    setAnalysis(a);
    setReview(initialReview(a));
    setPhase("review");
  }, [files]);

  const save = useCallback(() => {
    if (!review) return;
    try {
      const { todoId, noteId } = saveCapture(review, files, text);
      if (todoId) router.replace({ pathname: "/task", params: { id: todoId } });
      else router.replace({ pathname: "/note", params: { id: noteId } });
    } catch {
      Alert.alert("Couldn't save", "Something went wrong saving this. Please try again.");
    }
  }, [review, files, text]);

  const patch = useCallback((p: Partial<ReviewState>) => setReview((r) => (r ? { ...r, ...p } : r)), []);
  const applyPicked = (d: Date) => {
    if (!review) return;
    const base = review.due ? new Date(review.due) : new Date();
    if (picker === "date") {
      base.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      if (!review.due) base.setHours(23, 59, 0, 0);
      patch({ due: base });
    } else {
      base.setHours(d.getHours(), d.getMinutes(), 0, 0);
      patch({ due: base, dueHasTime: true });
    }
  };

  const pdfs = files.filter((f) => f.mimeType === "application/pdf").length;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center h-14 px-1">
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" className="w-12 h-12 items-center justify-center">
          <Feather name="arrow-left" size={22} color={C.ink800} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-black">Smart capture</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {phase === "pick" && (
          <>
            <Text className="text-[22px] font-bold text-black">Dump your photos here</Text>
            <Text className="text-sm text-ink-600 mt-1 leading-5">
              Assignments, worksheets, exam notices, posters — Seishin reads them, finds what's due and what to answer, and keeps reminding you.
            </Text>
            <View className="flex-row gap-2.5 mt-5">
              <Source icon="camera" label="Camera" onPress={fromCamera} />
              <Source icon="image" label="Photos" onPress={fromGallery} />
              <Source icon="hard-drive" label="Drive & files" onPress={fromFiles} />
            </View>
          </>
        )}

        {files.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mt-5">
            {files.map((f, i) =>
              (f.mimeType ?? "image/").startsWith("image/") ? (
                <Photo key={`${f.uri}-${i}`} uri={f.uri} width={100} height={100} />
              ) : (
                <View key={`${f.uri}-${i}`} className="w-[100px] h-[100px] rounded-xl bg-ink-50 items-center justify-center p-2">
                  <Feather name="file-text" size={22} color={C.ink600} />
                  <Text className="text-[10px] text-ink-600 mt-1 text-center" numberOfLines={2}>{f.name ?? "PDF"}</Text>
                </View>
              ),
            )}
          </View>
        )}
        {phase === "pick" && pdfs > 0 ? (
          <Text className="text-xs text-ink-500 mt-2">PDFs are attached to the note; text is read from photos only for now.</Text>
        ) : null}

        {phase === "reading" && (
          <View className="items-center py-14">
            <ActivityIndicator size="large" color={C.accent} />
            <Text className="text-sm font-semibold text-ink-700 mt-4">{progress}</Text>
          </View>
        )}

        {phase === "review" && review && analysis && (
          <View className="mt-5">
            {analysis.summary ? (
              <View className="rounded-2xl bg-ink-50 p-4 mb-5 flex-row gap-3">
                <Feather name={analysis.source === "ai" ? "zap" : "search"} size={16} color={C.accent} />
                <Text className="flex-1 text-sm text-ink-800 leading-5">{analysis.summary}</Text>
              </View>
            ) : null}
            {!text ? (
              <Text className="text-sm text-ink-600 mb-4">No text could be read from these photos — fill in the details below.</Text>
            ) : null}
            <CaptureReview
              value={review}
              onChange={patch}
              unsure={analysis.confidence < 0.5}
              onPickDate={() => setPicker("date")}
              onPickTime={() => setPicker("time")}
            />
          </View>
        )}
      </ScrollView>

      {phase !== "reading" && (
        <View className="px-5 pt-3 border-t border-ink-75" style={{ paddingBottom: kb > 0 ? 12 : insets.bottom + 12 }}>
          {phase === "pick" ? (
            <TouchableOpacity
              onPress={analyze}
              disabled={files.length === 0}
              accessibilityRole="button"
              className={`h-14 rounded-2xl items-center justify-center flex-row gap-2 ${files.length ? "bg-accent" : "bg-ink-100"}`}
            >
              <Feather name="zap" size={18} color={files.length ? C.onAccent : C.ink400} />
              <Text className={`text-base font-bold ${files.length ? "text-accent-on" : "text-ink-400"}`}>
                {files.length ? `Analyze ${files.length} item${files.length > 1 ? "s" : ""}` : "Add photos to begin"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={save} accessibilityRole="button" className="h-14 rounded-2xl bg-accent items-center justify-center">
              <Text className="text-base font-bold text-accent-on">
                {review?.reminder === "off" ? "Save" : "Save & remind me"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={{ height: kb }} />

      {Platform.OS === "android" && picker && review && (
        <DateTimePicker
          value={review.due ?? new Date()}
          mode={picker}
          onChange={(_, d) => { const was = picker; setPicker(null); if (d && was) applyPicked(d); }}
        />
      )}
      <PickerModal
        visible={Platform.OS !== "android" && picker !== null}
        title={picker === "date" ? "Due date" : "Due time"}
        mode={picker === "time" ? "time" : "date"}
        value={review?.due ?? new Date()}
        onConfirm={applyPicked}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function Source({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; onPress: () => void }) {
  const C = useColors();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} accessibilityRole="button" className="flex-1 h-24 rounded-2xl bg-ink-50 items-center justify-center gap-2">
      <Feather name={icon} size={24} color={C.black} />
      <Text className="text-[13px] font-semibold text-black">{label}</Text>
    </TouchableOpacity>
  );
}

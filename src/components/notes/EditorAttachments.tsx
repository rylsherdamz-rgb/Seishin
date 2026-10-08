import { memo } from "react";
import { View, Text, TouchableOpacity, useWindowDimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { NoteAttachment } from "@/stores/notes-store";
import { Photo } from "@/components/ui/Photo";
import { useColors } from "@/theme/ThemeProvider";

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Edge-to-edge photo tiles: 1 → full width, 2 → halves, 3+ → thirds. */
export const EditorImages = memo(function EditorImages({ images, onRemove }: { images: NoteAttachment[]; onRemove: (id: string) => void }) {
  const { width } = useWindowDimensions();
  if (images.length === 0) return null;
  const cols = images.length === 1 ? 1 : images.length === 2 ? 2 : 3;
  const gap = 2;
  const size = (width - gap * (cols - 1)) / cols;
  const height = cols === 1 ? Math.min(260, width * 0.66) : size;
  return (
    <View className="flex-row flex-wrap" style={{ gap }}>
      {images.map((a) => (
        <View key={a.id}>
          <Photo uri={a.uri} width={size} height={height} radius={0} />
          <RemoveButton onPress={() => onRemove(a.id)} label="Remove photo" />
        </View>
      ))}
    </View>
  );
});

export const EditorFiles = memo(function EditorFiles({ files, onRemove }: { files: NoteAttachment[]; onRemove: (id: string) => void }) {
  const C = useColors();
  if (files.length === 0) return null;
  return (
    <View className="gap-2 mt-2">
      {files.map((a) => (
        <View key={a.id} className="flex-row items-center gap-3 rounded-2xl border border-ink-100 px-3 py-2.5">
          <View className="w-10 h-10 rounded-xl bg-black/5 items-center justify-center">
            <Feather name="file-text" size={18} color={C.ink700} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-black" numberOfLines={1}>{a.name || "File"}</Text>
            <Text className="text-xs text-ink-500" numberOfLines={1}>{[a.mimeType, fmtSize(a.size)].filter(Boolean).join(" · ")}</Text>
          </View>
          <TouchableOpacity
            onPress={() => onRemove(a.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${a.name || "file"}`}
            className="w-11 h-11 items-center justify-center"
          >
            <Feather name="x" size={18} color={C.ink500} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
});

function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="absolute top-2 right-2 w-8 h-8 rounded-full items-center justify-center"
      // Fixed scrim (not the themed ink) so the white × reads on any photo.
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
    >
      <Feather name="x" size={15} color="#ffffff" />
    </TouchableOpacity>
  );
}

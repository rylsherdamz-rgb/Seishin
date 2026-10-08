import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { Note } from "@/stores/notes-store";
import { Photo } from "@/components/ui/Photo";
import { useTheme } from "@/theme/ThemeProvider";
import { noteBackground } from "@/theme/note-colors";

interface Props {
  note: Note;
  /** Grid cards clamp text harder than full-width list cards. */
  compact: boolean;
  onOpen: (id: string) => void;
  onLongPress: (note: Note) => void;
}

/**
 * Note card in the Material 3 / Keep idiom: outlined when uncolored, tonal
 * fill when colored, photos edge-to-edge on top, labels as small chips.
 * Memoized — only re-renders when its own note object changes.
 */
export const NoteCard = memo(function NoteCard({ note, compact, onOpen, onLongPress }: Props) {
  const { colors: C, dark } = useTheme();
  const fill = noteBackground(note.color, dark);
  const attachments = note.attachments ?? [];
  const images = attachments.filter((a) => a.type === "image");
  const fileCount = attachments.length - images.length;
  const tags = note.tags ?? [];
  const empty = !note.title && !note.body;

  return (
    <TouchableOpacity
      onPress={() => onOpen(note.id)}
      onLongPress={() => onLongPress(note)}
      delayLongPress={300}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${note.pinned ? "Pinned. " : ""}${note.title || note.body.slice(0, 60) || "Untitled note"}`}
      accessibilityHint="Long press for options"
      className="m-1.5 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: fill ?? C.white,
        borderWidth: fill ? 0 : 1,
        borderColor: C.ink150,
      }}
    >
      {images.length > 0 ? <CardImages uris={images.slice(0, 3).map((i) => i.uri)} compact={compact} /> : null}

      <View className="px-4 pt-3 pb-3.5 gap-1.5">
        {note.title ? (
          <Text className="text-base font-semibold text-black leading-[22px]" numberOfLines={compact ? 3 : 2}>
            {note.title}
          </Text>
        ) : null}
        {note.body ? (
          <Text className="text-sm text-ink-800 leading-5" numberOfLines={compact ? (images.length ? 5 : 10) : 4}>
            {note.body}
          </Text>
        ) : null}
        {empty && images.length === 0 ? <Text className="text-sm text-ink-400">Empty note</Text> : null}

        {tags.length > 0 || note.eventId || fileCount > 0 ? (
          <View className="flex-row flex-wrap gap-1.5 mt-1">
            {note.eventId ? <Chip icon="calendar" label="Event" /> : null}
            {fileCount > 0 ? <Chip icon="paperclip" label={String(fileCount)} /> : null}
            {tags.slice(0, compact ? 2 : 4).map((t) => <Chip key={t} label={t} />)}
            {tags.length > (compact ? 2 : 4) ? <Chip label={`+${tags.length - (compact ? 2 : 4)}`} /> : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

function CardImages({ uris, compact }: { uris: string[]; compact: boolean }) {
  const h = compact ? 120 : 160;
  if (uris.length === 1) return <Photo uri={uris[0]} width="100%" height={h} radius={0} />;
  return (
    <View className="flex-row" style={{ gap: 2 }}>
      {uris.map((u) => (
        <View key={u} className="flex-1">
          <Photo uri={u} width="100%" height={compact ? 90 : 120} radius={0} />
        </View>
      ))}
    </View>
  );
}

function Chip({ icon, label }: { icon?: React.ComponentProps<typeof Feather>["name"]; label: string }) {
  const { colors: C } = useTheme();
  return (
    <View className="flex-row items-center gap-1 h-6 px-2 rounded-md bg-black/5">
      {icon ? <Feather name={icon} size={11} color={C.ink700} /> : null}
      <Text className="text-[11px] font-medium text-ink-800" numberOfLines={1}>{label}</Text>
    </View>
  );
}

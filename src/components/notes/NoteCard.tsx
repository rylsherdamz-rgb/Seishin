import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import type { Note } from "@/stores/notes-store";
import { Photo } from "@/components/ui/Photo";
import { useColors } from "@/theme/ThemeProvider";

interface Props {
  note: Note;
  onOpen: (id: string) => void;
}

const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** Grid card for one note. Memoized so unrelated store updates skip it. */
export const NoteCard = memo(function NoteCard({ note, onOpen }: Props) {
  const C = useColors();
  const attachments = note.attachments ?? [];
  const tags = note.tags ?? [];
  const firstImage = attachments.find((a) => a.type === "image");
  const fileCount = attachments.filter((a) => a.type === "file").length;

  return (
    <TouchableOpacity
      onPress={() => onOpen(note.id)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={note.title || "Untitled note"}
      className={`flex-1 m-1.5 rounded-[20px] overflow-hidden ${note.pinned ? "bg-accent" : "bg-ink-50"}`}
    >
      {firstImage ? <Photo uri={firstImage.uri} width="100%" height={96} radius={0} /> : null}
      <View className="p-3.5 gap-1.5">
        <View className="flex-row items-start gap-2">
          <Text
            className={`text-[15px] font-bold flex-1 ${note.pinned ? "text-accent-on" : note.title ? "text-black" : "text-ink-400"}`}
            numberOfLines={2}
          >
            {note.title || "Untitled"}
          </Text>
          {note.pinned ? <Feather name="bookmark" size={13} color={C.onAccent} /> : null}
        </View>
        {note.body ? (
          <Text
            className={`text-xs leading-[18px] ${note.pinned ? "text-accent-on opacity-85" : "text-ink-600"}`}
            numberOfLines={firstImage ? 3 : 7}
          >
            {note.body}
          </Text>
        ) : null}
        {tags.length > 0 || note.eventId || fileCount > 0 ? (
          <View className="flex-row flex-wrap items-center gap-1 mt-0.5">
            {note.eventId ? <Badge icon="calendar" label="event" pinned={note.pinned} /> : null}
            {fileCount > 0 ? <Badge icon="paperclip" label={String(fileCount)} pinned={note.pinned} /> : null}
            {tags.slice(0, 3).map((t) => <Badge key={t} label={`#${t}`} pinned={note.pinned} />)}
          </View>
        ) : null}
        <Text className={`text-[11px] font-semibold ${note.pinned ? "text-accent-on opacity-70" : "text-ink-400"}`}>
          {new Date(note.updatedAt).toLocaleDateString(undefined, dateFmt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

function Badge({ icon, label, pinned }: { icon?: React.ComponentProps<typeof Feather>["name"]; label: string; pinned?: boolean }) {
  const C = useColors();
  return (
    <View className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${pinned ? "bg-accent-on/20" : "bg-white"}`}>
      {icon ? <Feather name={icon} size={9} color={pinned ? C.onAccent : C.ink500} /> : null}
      <Text className={`text-[10px] font-semibold ${pinned ? "text-accent-on" : "text-ink-600"}`}>{label}</Text>
    </View>
  );
}

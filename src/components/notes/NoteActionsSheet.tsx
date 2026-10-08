import { useRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import BottomSheet, { BottomSheetView } from "@expo/ui/community/bottom-sheet";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNotesStore, type Note } from "@/stores/notes-store";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { useColors } from "@/theme/ThemeProvider";
import type { NoteColorId } from "@/theme/note-colors";
import { uid } from "@/utils/id";
import { NoteColorPicker } from "./NoteColorPicker";

interface Props {
  note: Note;
  onClose: () => void;
}

/** Long-press menu for a note card: pin, recolor, copy, delete. Mount to open. */
export function NoteActionsSheet({ note, onClose }: Props) {
  const C = useColors();
  const sheetRef = useRef<BottomSheet>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const togglePin = useNotesStore((s) => s.togglePin);
  const updateNote = useNotesStore((s) => s.updateNote);
  const addNote = useNotesStore((s) => s.addNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);
  // Live copy so the color check mark follows taps while the sheet is open.
  const live = useNotesStore((s) => s.notes.find((n) => n.id === note.id)) ?? note;

  const close = () => {
    sheetRef.current?.close();
    onClose();
  };
  const setColor = (c: NoteColorId) => updateNote(note.id, { color: c === "default" ? undefined : c });
  const copy = () => {
    const now = new Date().toISOString();
    addNote({ ...live, id: uid("note"), pinned: false, title: live.title ? `${live.title} (copy)` : "", createdAt: now, updatedAt: now });
    close();
  };

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={0}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: C.white }}
        onChange={(i: number) => { if (i === -1 && !confirmDelete) onClose(); }}
      >
        <BottomSheetView style={{ paddingTop: 4, paddingBottom: 28 }}>
          <Text className="px-5 text-base font-semibold text-black" numberOfLines={1}>
            {live.title || live.body.split("\n")[0] || "Untitled note"}
          </Text>
          <Text className="px-5 mt-3 text-[11px] font-bold tracking-widest text-ink-500">COLOR</Text>
          <NoteColorPicker value={live.color} onChange={setColor} />
          <View className="h-px bg-ink-75 mx-5 my-2" />
          <Row
            icon={<Ionicons name={live.pinned ? "pin" : "pin-outline"} size={20} color={C.ink800} />}
            label={live.pinned ? "Unpin" : "Pin to top"}
            onPress={() => { togglePin(note.id); close(); }}
          />
          <Row icon={<Feather name="copy" size={19} color={C.ink800} />} label="Make a copy" onPress={copy} />
          <Row
            icon={<Feather name="trash-2" size={19} color={C.danger} />}
            label="Delete"
            destructive
            onPress={() => setConfirmDelete(true)}
          />
        </BottomSheetView>
      </BottomSheet>
      <AlertDialog
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete note?"
        message="This note will be permanently removed. This can't be undone."
        confirmLabel="Delete"
        confirmDestructive
        onConfirm={() => { deleteNote(note.id); close(); }}
      />
    </>
  );
}

function Row({ icon, label, onPress, destructive }: { icon: React.ReactNode; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6} accessibilityRole="button" className="flex-row items-center gap-4 px-5 h-14">
      {icon}
      <Text className={`text-[15px] font-medium ${destructive ? "text-danger" : "text-black"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

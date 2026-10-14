import { useState } from "react";
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { exportBackup, lastBackupAt, pickBackup, restoreBackup } from "@/services/backup-io";
import type { Backup, BackupCounts } from "@/services/backup";

const summary = (c: BackupCounts) => `${c.events} events, ${c.todos} tasks and ${c.notes} notes`;

function since(iso: string | null): string {
  if (!iso) return "Never backed up";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return days === 0 ? "Last backup today" : `Last backup ${days} day${days > 1 ? "s" : ""} ago`;
}

/** Settings block: save everything to a file (e.g. Google Drive) and restore it. */
export function BackupSection() {
  const C = useColors();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [last, setLast] = useState(lastBackupAt);
  const stale = !last || Date.now() - Date.parse(last) > 14 * 86400000;

  const doExport = async () => {
    setBusy("export");
    try {
      const res = await exportBackup();
      if (res) {
        setLast(lastBackupAt());
        Alert.alert("Backup saved", `Saved ${summary(res)}. Photos inside notes aren't included — keep them in your gallery or Drive.`);
      }
    } catch {
      Alert.alert("Backup failed", "Couldn't write the file. Pick a different folder and try again.");
    } finally {
      setBusy(null);
    }
  };

  const apply = (b: Backup, mode: "merge" | "replace") => {
    const res = restoreBackup(b, mode);
    Alert.alert("Restored", `${mode === "merge" ? "Added" : "Restored"} ${summary(res)}.`);
  };

  const doImport = async () => {
    setBusy("import");
    let b: Backup | null = null;
    try {
      b = await pickBackup();
    } catch (e) {
      Alert.alert("Can't restore", e instanceof Error ? e.message : "That file couldn't be read.");
    } finally {
      setBusy(null);
    }
    if (!b) return;
    const backup = b;
    const made = backup.createdAt ? new Date(backup.createdAt).toLocaleDateString() : "an unknown date";
    Alert.alert("Restore backup?", `From ${made}: ${summary({ events: backup.events.length, todos: backup.todos.length, notes: backup.notes.length })}.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Merge", onPress: () => apply(backup, "merge") },
      {
        text: "Replace all",
        style: "destructive",
        onPress: () =>
          Alert.alert("Replace everything?", "Your current events, tasks and notes on this phone will be replaced by the backup. This can't be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Replace", style: "destructive", onPress: () => apply(backup, "replace") },
          ]),
      },
    ]);
  };

  return (
    <View className="rounded-[20px] bg-ink-50 overflow-hidden mb-4">
      <Row icon="upload-cloud" label="Back up now" sub={since(last)} warn={stale} busy={busy === "export"} onPress={doExport} />
      <View className="h-px bg-ink-75 mx-4" />
      <Row icon="download-cloud" label="Restore from a backup" sub="Merge with what's here, or replace it" busy={busy === "import"} onPress={doImport} />
      <Text className="text-xs text-ink-500 px-4 pb-3 -mt-1">
        Tip: save to Google Drive so a lost or new phone gets everything back. API keys and sign-ins are never included.
      </Text>
    </View>
  );

  function Row({ icon, label, sub, warn, busy: rowBusy, onPress }: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; sub: string; warn?: boolean; busy: boolean; onPress: () => void }) {
    return (
      <TouchableOpacity onPress={onPress} disabled={!!busy} accessibilityRole="button" className="flex-row items-center gap-3 min-h-[60px] px-4">
        <View className="w-9 h-9 bg-white rounded-xl items-center justify-center">
          {rowBusy ? <ActivityIndicator size="small" color={C.black} /> : <Feather name={icon} size={16} color={C.black} />}
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-black">{label}</Text>
          <Text className={`text-xs mt-0.5 ${warn ? "text-danger" : "text-ink-500"}`}>{sub}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={C.ink300} />
      </TouchableOpacity>
    );
  }
}

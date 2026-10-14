/** Device side of Backup & restore: pick a folder / file, read and write. */
import { Platform, Share } from "react-native";
import * as FS from "expo-file-system/legacy";
import { getDocumentAsync } from "expo-document-picker";
import { settingsStorage } from "@/stores/mmkv";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useNotesStore } from "@/stores/notes-store";
import { useThemeStore } from "@/stores/theme-store";
import { ACCENTS, THEMES, type AccentId, type ThemeMode } from "@/theme/themes";
import { buildBackup, countBackup, mergeById, noteIsNewer, parseBackup, PORTABLE_PREF_KEYS, type Backup, type BackupCounts } from "./backup";

const LAST_KEY = "settings:backup:last";

function currentBackup(): Backup {
  const prefs: Record<string, string> = {};
  for (const k of PORTABLE_PREF_KEYS) {
    const v = settingsStorage.getString(k);
    if (v) prefs[k] = v;
  }
  return buildBackup(useCalendarStore.getState().events, useTodoStore.getState().todos, useNotesStore.getState().notes, prefs);
}

const fileName = () => `seishin-backup-${new Date().toISOString().slice(0, 10)}`;

/**
 * Save a backup file. Android: the user picks any folder (Downloads, Google
 * Drive, an SD card…) via the system picker. iOS: the share sheet (Files,
 * iCloud Drive, AirDrop). Returns the counts, or null if cancelled.
 */
export async function exportBackup(): Promise<BackupCounts | null> {
  const backup = currentBackup();
  const json = JSON.stringify(backup);
  if (Platform.OS === "android") {
    const perm = await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return null;
    const uri = await FS.StorageAccessFramework.createFileAsync(perm.directoryUri, fileName(), "application/json");
    await FS.writeAsStringAsync(uri, json);
  } else {
    const uri = `${FS.cacheDirectory}${fileName()}.json`;
    await FS.writeAsStringAsync(uri, json);
    const res = await Share.share({ url: uri, title: "Seishin backup" });
    if (res.action === Share.dismissedAction) return null;
  }
  settingsStorage.set(LAST_KEY, backup.createdAt);
  return countBackup(backup);
}

export function lastBackupAt(): string | null {
  return settingsStorage.getString(LAST_KEY) ?? null;
}

/** Let the user pick a backup file; returns it parsed (throws readable errors). */
export async function pickBackup(): Promise<Backup | null> {
  const res = await getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  return parseBackup(await FS.readAsStringAsync(res.assets[0].uri));
}

/** "merge" keeps everything on the phone and adds what's missing; "replace" swaps it all. */
export function restoreBackup(b: Backup, mode: "merge" | "replace"): BackupCounts {
  const cal = useCalendarStore.getState();
  const own = cal.events.filter((e) => e.source !== "calendar" && e.source !== "feed");
  const nextEvents = mode === "replace" ? b.events : mergeById(own, b.events);
  const keep = new Set(nextEvents.map((e) => e.id));
  cal.applyImport(nextEvents, own.filter((e) => !keep.has(e.id)).map((e) => e.id));

  const todos = useTodoStore.getState();
  todos.replaceAll(mode === "replace" ? b.todos : mergeById(todos.todos, b.todos));

  const notes = useNotesStore.getState();
  notes.replaceAll(mode === "replace" ? b.notes : mergeById(notes.notes, b.notes, noteIsNewer));

  for (const [k, v] of Object.entries(b.prefs)) settingsStorage.set(k, v);
  const theme = useThemeStore.getState();
  const themeMode = b.prefs["settings:theme:mode"];
  const accent = b.prefs["settings:theme:accent"];
  if (themeMode === "system" || (themeMode && themeMode in THEMES)) theme.setMode(themeMode as ThemeMode);
  if (accent && accent in ACCENTS) theme.setAccent(accent as AccentId);
  return countBackup(b);
}

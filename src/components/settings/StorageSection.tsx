import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Card } from "@/components/ui/Card";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { useColors } from "@/theme/ThemeProvider";
import { getStorageSizes, eventsStorage, agentStorage, ocrStorage, todosStorage, invitesStorage } from "@/stores/mmkv";
import { factoryReset } from "@/services/factory-reset";
import { CollapsibleHeader, SectionHeader, type Notice } from "./rows";

const CATEGORIES = [
  { label: "Calendar Events", key: "events" as const, storage: eventsStorage, icon: "calendar" as const },
  { label: "Agent Memory", key: "agent" as const, storage: agentStorage, icon: "cpu" as const },
  { label: "Scan History", key: "ocr" as const, storage: ocrStorage, icon: "camera" as const },
  { label: "Tasks", key: "todos" as const, storage: todosStorage, icon: "check-square" as const },
  { label: "Invites", key: "invites" as const, storage: invitesStorage, icon: "send" as const },
];

type Confirm = { title: string; message: string; label: string; onConfirm: () => void | Promise<void> };
const plural = (n: number) => `${n} item${n === 1 ? "" : "s"}`;

/** Per-store item counts with Clear, and the factory reset. Every delete asks first (RULES). */
export function StorageSection({ onNotice }: { onNotice: Notice }) {
  const T = useColors();
  const [open, setOpen] = useState(false);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  useEffect(() => { setSizes(getStorageSizes()); }, []);

  const clear = useCallback((label: string, count: number, run: () => void) => {
    setConfirm({
      title: `Clear ${label}`,
      message: `Deletes ${plural(count)}. This can't be undone.`,
      label: "Clear",
      onConfirm: () => { run(); setSizes(getStorageSizes()); },
    });
  }, []);

  const reset = useCallback(() => {
    setConfirm({
      title: "Factory reset",
      message: "Deletes all events, tasks, notes, messages, settings, connector sign-ins and scheduled reminders on this phone. Your Google, Todoist and Notion data is not touched. This can't be undone.",
      label: "Delete everything",
      onConfirm: async () => {
        const res = await factoryReset();
        setSizes(getStorageSizes());
        if (res.ok) onNotice("Done", "Everything on this phone has been cleared.");
        else onNotice("Partly done", `Data was cleared, but these steps failed: ${res.failed.join(", ")}. Restart the app and try again.`);
      },
    });
  }, [onNotice]);

  return (
    <>
      <SectionHeader title="Storage" />
      <CollapsibleHeader icon="hard-drive" title="Data Storage" subtitle="Manage cached data per category" open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <Card className="mb-4 p-0 overflow-hidden">
          {CATEGORIES.map(({ label, key, storage, icon }) => (
            <View key={key} className="flex-row items-center gap-3 py-3 px-4 border-b border-ink-100 last:border-b-0">
              <View className="w-8 h-8 bg-ink-100 rounded-lg items-center justify-center">
                <Feather name={icon} size={12} color={T.ink500} />
              </View>
              <View className="flex-1">
                <Text className="text-sm text-black">{label}</Text>
                <Text className="text-xs text-ink-300">{plural(sizes[key] ?? 0)}</Text>
              </View>
              <TouchableOpacity onPress={() => clear(label, sizes[key] ?? 0, () => storage.clearAll())} className="px-3 py-1.5 rounded-lg bg-ink-100">
                <Text className="text-xs text-ink-500 font-medium">Clear</Text>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      )}

      <TouchableOpacity onPress={reset} accessibilityRole="button" className="flex-row items-center justify-center gap-2 h-12 mb-4 rounded-2xl border border-danger">
        <Feather name="alert-triangle" size={14} color={T.danger} />
        <Text className="text-sm font-semibold text-danger">Factory reset — delete everything</Text>
      </TouchableOpacity>

      <AlertDialog
        visible={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        confirmDestructive
        onConfirm={() => { void confirm?.onConfirm(); setConfirm(null); }}
      />
    </>
  );
}

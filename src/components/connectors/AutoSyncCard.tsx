import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { backgroundSyncAvailable } from "@/services/background-sync";
import { lastSyncReport, syncEverything, type SyncReport } from "@/services/connectors/sync-all";
import { ago } from "./shared";

/** Shows that everything syncs on its own, with a manual "sync everything". */
export function AutoSyncCard({ onSynced }: { onSynced?: () => void }) {
  const C = useColors();
  const [report, setReport] = useState<SyncReport | null>(lastSyncReport);
  const [bg, setBg] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { backgroundSyncAvailable().then(setBg); }, []);

  const run = async () => {
    setBusy(true);
    setReport(await syncEverything("manual"));
    setBusy(false);
    onSynced?.();
  };

  return (
    <View className="rounded-[20px] bg-accent/10 p-4">
      <View className="flex-row items-center gap-3">
        <View className="w-11 h-11 rounded-2xl bg-accent items-center justify-center">
          <Feather name="refresh-cw" size={19} color={C.onAccent} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-black">Auto-sync is on</Text>
          <Text className="text-xs text-ink-600">
            {bg === false ? "Syncs when you open the app (background limited by this phone)" : "Every ~30 min in the background, on open, and after edits"}
          </Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between mt-3">
        <Text className={`text-[13px] ${report?.errors.length ? "text-danger" : "text-ink-700"}`}>
          {report ? `Last sync ${ago(report.at)}${report.errors.length ? ` · issue with ${report.errors.join(", ")}` : ""}` : "Not synced yet"}
        </Text>
        <TouchableOpacity onPress={run} disabled={busy} accessibilityRole="button" className="h-10 px-4 rounded-full bg-white flex-row items-center gap-2">
          {busy ? <ActivityIndicator size="small" color={C.black} /> : <Feather name="zap" size={14} color={C.black} />}
          <Text className="text-[13px] font-semibold text-black">Sync all now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

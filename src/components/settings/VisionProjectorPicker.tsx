import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Feather from "@expo/vector-icons/Feather";
import { useSettingsStore } from "@/stores/settings-store";
import { unloadModel } from "@/services/local-llama";
import { useColors } from "@/theme/ThemeProvider";

const fileName = (path: string | null) => (path ? path.split("/").pop() ?? "" : "");

/**
 * Optional vision projector (mmproj .gguf) for the on-device model. With it, a
 * multimodal model (e.g. the Seishin Vision fine-tune in training/) can see the
 * photos attached in the agent chat. Changing it unloads the model so the agent
 * reloads both files.
 */
export function VisionProjectorPicker({ onMessage }: { onMessage: (title: string, message: string) => void }) {
  const T = useColors();
  const mmprojPath = useSettingsStore((s) => s.mmprojPath);
  const setMmprojPath = useSettingsStore((s) => s.setMmprojPath);
  const [busy, setBusy] = useState(false);

  const pick = useCallback(async () => {
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: false });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const name = asset.name || `mmproj-${Date.now()}.gguf`;
      if (!/\.gguf$/i.test(name)) {
        onMessage("Not a projector", "Pick the mmproj .gguf file that came with your model.");
        return;
      }
      const dir = `${FileSystem.documentDirectory || ""}Models/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      await FileSystem.copyAsync({ from: asset.uri, to: `${dir}${name}` });
      await unloadModel();
      setMmprojPath(`${dir}${name}`);
      onMessage("Saved", "Vision projector added. The model reloads in the Agent tab and can now see attached photos.");
    } catch (e) {
      onMessage("Copy failed", (e instanceof Error && e.message) || "Could not copy the projector file. Try again.");
    } finally {
      setBusy(false);
    }
  }, [onMessage, setMmprojPath]);

  const remove = useCallback(() => {
    if (!mmprojPath) return;
    Alert.alert("Remove vision projector?", `Deletes ${fileName(mmprojPath)} from this phone. The model keeps working with text only.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await unloadModel();
          setMmprojPath(null);
          await FileSystem.deleteAsync(mmprojPath, { idempotent: true }).catch(() => {});
        },
      },
    ]);
  }, [mmprojPath, setMmprojPath]);

  return (
    <View className="mt-4">
      <Text className="text-sm font-semibold text-black">Vision projector · optional</Text>
      <Text className="text-xs text-ink-400 mt-0.5 mb-3">
        The mmproj .gguf that comes with a multimodal model. Lets it read the photos you attach — posters, bills, schedules.
      </Text>
      <TouchableOpacity
        onPress={pick}
        disabled={busy}
        className="h-11 bg-white border border-ink-200 rounded-lg px-4 flex-row items-center gap-3"
      >
        {busy ? <ActivityIndicator size="small" color={T.ink300} /> : <Feather name="eye" size={16} color={T.ink300} />}
        <Text className={`text-sm flex-1 ${mmprojPath ? "text-black" : "text-ink-300"}`} numberOfLines={1}>
          {busy ? "Copying projector…" : fileName(mmprojPath) || "None — text only. Tap to add"}
        </Text>
        {!!mmprojPath && !busy && (
          <TouchableOpacity onPress={remove} hitSlop={8}>
            <Feather name="x-circle" size={14} color={T.ink200} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
}

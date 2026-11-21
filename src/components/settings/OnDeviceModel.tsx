import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { useSettingsStore } from "@/stores/settings-store";
import { planModelSave } from "@/utils/model-file";
import { createLogger } from "@/utils/logger";
import type { Notice } from "./rows";

const log = createLogger("settings");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const baseName = (p: string) => p.split("/").pop() || "";

/** Pick a .gguf, copy it into app storage (replacing the previous one) and point llama.rn at it. */
export function OnDeviceModel({ onNotice }: { onNotice: Notice }) {
  const T = useColors();
  const modelPath = useSettingsStore((s) => s.modelPath);
  const setModelPath = useSettingsStore((s) => s.setModelPath);
  const [picked, setPicked] = useState(modelPath || "");
  const [name, setName] = useState(modelPath ? baseName(modelPath) : "");
  const [size, setSize] = useState(0);
  const [picking, setPicking] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    setPicked(modelPath || "");
    setName(modelPath ? baseName(modelPath) : "");
  }, [modelPath]);

  const pick = useCallback(async () => {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: false });
      const asset = !result.canceled ? result.assets?.[0] : undefined;
      if (asset) { setPicked(asset.uri); setName(asset.name || ""); setSize(asset.size ?? 0); }
    } catch {
      onNotice("Could not browse files", "The file picker did not respond. Try again.");
    } finally {
      setPicking(false);
    }
  }, [onNotice]);

  const removeQuietly = (path: string | null) => {
    if (path) FileSystem.deleteAsync(path, { idempotent: true }).catch((e) => log.warn("could not delete old model", e));
  };

  const save = useCallback(async () => {
    const plan = planModelSave(picked, modelPath, name, `${FileSystem.documentDirectory || ""}Models/`);
    if (plan.kind === "unchanged") return onNotice("Saved", "This model is already set up.");
    if (plan.kind === "clear") {
      setModelPath(null);
      removeQuietly(plan.remove);
      return onNotice("Saved", "On-device model removed.");
    }
    setCopying(true);
    try {
      await FileSystem.makeDirectoryAsync(plan.dest.slice(0, plan.dest.lastIndexOf("/") + 1), { intermediates: true });
      await FileSystem.copyAsync({ from: plan.from, to: plan.dest });
      setModelPath(plan.dest);
      removeQuietly(plan.remove);
      onNotice("Saved", `Model copied and ready. (${baseName(plan.dest)})`);
    } catch (e) {
      onNotice("Copy Failed", (e instanceof Error && e.message) || "Could not copy the model file. Try picking from a different location.");
    } finally {
      setCopying(false);
    }
  }, [picked, modelPath, name, setModelPath, onNotice]);

  return (
    <>
      <Text className="text-sm font-semibold text-black">On-device model</Text>
      <Text className="text-xs text-ink-400 mt-0.5 mb-3">
        A .gguf file that runs on this phone — offline and private. It can add and change your events, tasks and notes.
      </Text>
      <TouchableOpacity onPress={pick} disabled={picking || copying} className="h-11 bg-white border border-ink-200 rounded-lg px-4 flex-row items-center gap-3 mb-2">
        {picking ? <ActivityIndicator size="small" color={T.ink300} /> : <Feather name="folder" size={16} color={T.ink300} />}
        <Text className={`text-sm flex-1 ${name ? "text-black" : "text-ink-300"}`} numberOfLines={1}>
          {name || (picking ? "Reading large file…" : "Tap to select a .gguf file")}
        </Text>
        {!!name && !copying && (
          <TouchableOpacity onPress={() => { setPicked(""); setName(""); setSize(0); }} accessibilityLabel="Remove model">
            <Feather name="x-circle" size={14} color={T.ink200} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {copying && (
        <View className="bg-ink-50 rounded-lg p-3 mb-2 flex-row items-center gap-2">
          <ActivityIndicator size="small" color={T.ink500} />
          <Text className="text-xs text-ink-600 flex-1">
            Copying{size > 0 ? ` ${formatBytes(size)}` : ""}… You can keep using Settings meanwhile.
          </Text>
        </View>
      )}
      <TouchableOpacity hitSlop={4} onPress={save} disabled={copying || picked === (modelPath || "")} className="bg-black h-9 px-5 rounded-lg items-center justify-center self-end">
        <Text className="text-white text-sm font-semibold">Save</Text>
      </TouchableOpacity>
    </>
  );
}

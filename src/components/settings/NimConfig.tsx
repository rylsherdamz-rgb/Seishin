import { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, TextInput, ScrollView } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { TierBadge } from "@/components/ui/TierBadge";
import { useColors } from "@/theme/ThemeProvider";
import { useSettingsStore } from "@/stores/settings-store";
import { fetchNimModels, fetchAllNimModels, cacheNimModels } from "@/services/nim-models";
import { ModelPicker } from "./ModelPicker";
import type { Notice } from "./rows";

const DEFAULT_ENDPOINT = "https://integrate.api.nvidia.com/v1";
const QUICK_MODELS = [
  { id: "meta/llama-3.2-1b-instruct", label: "Llama 1B", desc: "Fastest" },
  { id: "meta/llama-3.2-3b-instruct", label: "Llama 3B", desc: "Balanced" },
  { id: "mistralai/mistral-7b-instruct-v0.3", label: "Mistral 7B", desc: "Smart" },
  { id: "nvidia/llama-3.1-nemotron-70b-instruct", label: "Nemotron 70B", desc: "Best" },
];

function Field({ label, ...input }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const T = useColors();
  return (
    <>
      <Text className="text-xs font-semibold text-ink-400 mb-2 mt-3">{label}</Text>
      <TextInput className="h-11 bg-white border border-ink-200 rounded-lg px-4 text-sm text-black mb-2" placeholderTextColor={T.ink200} autoCapitalize="none" autoCorrect={false} {...input} />
    </>
  );
}

/** Optional NVIDIA NIM cloud provider: key (SecureStore), endpoint and model. */
export function NimConfig({ onNotice }: { onNotice: Notice }) {
  const T = useColors();
  const savedKey = useSettingsStore((s) => s.apiKeys.nim);
  const savedEndpoint = useSettingsStore((s) => s.nimEndpoint);
  const savedModel = useSettingsStore((s) => s.nimModel);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const setNimEndpoint = useSettingsStore((s) => s.setNimEndpoint);
  const setNimModel = useSettingsStore((s) => s.setNimModel);
  const [key, setKey] = useState(savedKey);
  const [endpoint, setEndpoint] = useState(savedEndpoint);
  const [model, setModel] = useState(savedModel);
  const [models, setModels] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setKey(savedKey); setEndpoint(savedEndpoint); setModel(savedModel); }, [savedKey, savedEndpoint, savedModel]);

  const baseUrl = (endpoint || DEFAULT_ENDPOINT).trim().replace(/\/+$/, "");

  const save = useCallback(async () => {
    setApiKey("nim", key);
    setNimEndpoint(endpoint);
    let chosen = model;
    if (key) {
      try {
        const result = await fetchNimModels(baseUrl, key);
        cacheNimModels(result.models);
        setModels(result.models);
        // Upgrade to the recommended model when the key unlocks a large one — and save it, not just show it.
        if (result.largeModel && !model.includes("70b") && !model.includes("nemotron")) chosen = result.recommended;
      } catch {
        // Non-blocking: the configured model still works.
      }
    }
    setModel(chosen);
    setNimModel(chosen);
    onNotice("Saved", "NVIDIA NIM config updated. Switch to NIM mode in the Agent tab.");
  }, [key, endpoint, baseUrl, model, setApiKey, setNimEndpoint, setNimModel, onNotice]);

  const openPicker = useCallback(async () => {
    setPickerOpen(true);
    if (models.length > 0) return;
    setLoading(true);
    try {
      setModels((await fetchAllNimModels(baseUrl, key || savedKey)).sort());
    } catch {
      onNotice("Could not load models", "Check your API key and endpoint, then try again.");
    } finally {
      setLoading(false);
    }
  }, [models.length, baseUrl, key, savedKey, onNotice]);

  return (
    <>
      <Text className="text-sm font-semibold text-black">NVIDIA NIM · optional cloud</Text>
      <Text className="text-xs text-ink-400 mt-0.5">
        Bigger models over the internet with every tool. Only used when you pick NVIDIA NIM in the agent.
      </Text>
      <Field label="NVIDIA NIM API Key" placeholder="Enter your NVIDIA NIM key..." value={key} onChangeText={setKey} secureTextEntry />
      <Field label="NIM Endpoint" placeholder={DEFAULT_ENDPOINT} value={endpoint} onChangeText={setEndpoint} keyboardType="url" />
      <Text className="text-xs font-semibold text-ink-400 mb-2 mt-3">Model</Text>
      <TouchableOpacity onPress={openPicker} className="h-11 bg-white border border-ink-200 rounded-lg px-4 flex-row items-center justify-between mb-2">
        <Text className={`text-sm flex-1 ${model ? "text-black" : "text-ink-300"}`} numberOfLines={1}>{model || "Select a model..."}</Text>
        {!!model && <TierBadge modelId={model} className="mr-2" />}
        <Feather name="chevron-down" size={16} color={T.ink200} />
      </TouchableOpacity>
      <Text className="text-xs font-semibold text-ink-400 mb-2 mt-3">Quick Models</Text>
      <ScrollView horizontal bounces className="mb-2" showsHorizontalScrollIndicator={false}>
        {QUICK_MODELS.map((m) => (
          <TouchableOpacity key={m.id} onPress={() => setModel(m.id)} className={`px-3 py-2 mr-2 rounded-xl border ${model === m.id ? "bg-black border-black" : "bg-white border-ink-200"}`}>
            <Text className={`text-xs font-medium ${model === m.id ? "text-white" : "text-black"}`}>{m.label}</Text>
            <Text className={`text-[10px] mt-0.5 ${model === m.id ? "text-white/70" : "text-ink-400"}`}>{m.desc}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity onPress={save} className="bg-black h-9 px-5 rounded-lg items-center justify-center self-end">
        <Text className="text-white text-sm font-semibold">Save</Text>
      </TouchableOpacity>
      <ModelPicker open={pickerOpen} loading={loading} models={models} selected={model} onSelect={setModel} onClose={() => setPickerOpen(false)} />
    </>
  );
}

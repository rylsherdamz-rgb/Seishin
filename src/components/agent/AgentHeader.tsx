import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useAgentStore } from "@/stores/agent-store";
import { useSettingsStore } from "@/stores/settings-store";
import { categorizeModel, getTierLabel } from "@/services/nim-models";
import { loadModel } from "@/services/local-llama";
import { LOCAL_TOOL_NAMES } from "@/services/agent-engine";
import { useColors } from "@/theme/ThemeProvider";

type IconName = React.ComponentProps<typeof Feather>["name"];

// Static class names: NativeWind only generates classes it can see verbatim.
const TIER_STYLE: Record<string, { bg: string; text: string }> = {
  fast: { bg: "bg-green-100", text: "text-green-700" },
  balanced: { bg: "bg-yellow-100", text: "text-yellow-700" },
  smart: { bg: "bg-red-100", text: "text-red-700" },
};

/** What the agent can do, shown so the tools aren't invisible. */
export const AGENT_SKILLS = ["Calendar", "Tasks", "Notes", "Memory"];

const ggufName = (path: string | null) => (path ? (path.split("/").pop() ?? "").replace(/\.gguf$/i, "") : "");

/**
 * Agent title, the brain switch (On-device first, NVIDIA NIM optional) and a
 * status line for whichever is active — so it is always clear what is
 * answering and that it can act through tools.
 */
export function AgentHeader({ onClear }: { onClear: () => void }) {
  const C = useColors();
  const provider = useAgentStore((s) => s.currentProvider);
  const setProvider = useAgentStore((s) => s.setProvider);
  const isProcessing = useAgentStore((s) => s.isProcessing);
  const hasKey = useSettingsStore((s) => !!s.apiKeys.nim);

  const pickNim = () => (hasKey ? setProvider("nim") : router.push("/settings"));

  return (
    <View className="px-4 pt-3 pb-2">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1 pr-3">
          <Text className="text-[30px] font-extrabold tracking-tightest text-black">AI Agent</Text>
          <Text className="text-sm text-ink-500 mt-0.5" numberOfLines={1}>
            {provider === "local" ? "On your phone · works offline" : "NVIDIA NIM · cloud"}
            {isProcessing ? " · Thinking…" : ""}
          </Text>
        </View>
        <View className="flex-row gap-2">
          <HeaderButton icon="settings" label="AI settings" onPress={() => router.push("/settings")} />
          <HeaderButton icon="trash-2" label="Clear conversation" onPress={onClear} />
        </View>
      </View>

      <View className="flex-row gap-2">
        <BrainOption
          icon="smartphone"
          title="On-device"
          hint={`Offline · ${LOCAL_TOOL_NAMES.length} tools`}
          active={provider === "local"}
          onPress={() => setProvider("local")}
        />
        <BrainOption
          icon="cloud"
          title="NVIDIA NIM"
          hint={hasKey ? "Cloud · all tools" : "Optional · add key"}
          active={provider === "nim"}
          onPress={pickNim}
        />
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5 mt-2.5">
        <Feather name="tool" size={12} color={C.ink400} />
        <Text className="text-[11px] text-ink-400">Can manage:</Text>
        {AGENT_SKILLS.map((s) => (
          <View key={s} className="px-2 py-0.5 rounded-full bg-ink-50">
            <Text className="text-[11px] font-medium text-ink-600">{s}</Text>
          </View>
        ))}
      </View>

      <View className="mt-2.5">{provider === "local" ? <LocalStatus /> : <NimStatus hasKey={hasKey} />}</View>
    </View>
  );
}

function HeaderButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="w-11 h-11 bg-ink-50 rounded-full items-center justify-center"
    >
      <Feather name={icon} size={14} color={C.ink500} />
    </TouchableOpacity>
  );
}

function BrainOption({ icon, title, hint, active, onPress }: { icon: IconName; title: string; hint: string; active: boolean; onPress: () => void }) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${title}. ${hint}`}
      className={`flex-1 flex-row items-center gap-2.5 px-3 py-2.5 rounded-2xl ${active ? "bg-black" : "bg-ink-50 border border-ink-100"}`}
    >
      <Feather name={icon} size={16} color={active ? C.white : C.ink600} />
      <View className="flex-1">
        <Text className={`text-[13px] font-bold ${active ? "text-white" : "text-black"}`} numberOfLines={1}>{title}</Text>
        <Text className={`text-[11px] ${active ? "text-white opacity-75" : "text-ink-400"}`} numberOfLines={1}>{hint}</Text>
      </View>
    </TouchableOpacity>
  );
}

function StatusRow({ icon, tone = "muted", children, action }: { icon: IconName; tone?: "muted" | "ok" | "error"; children: React.ReactNode; action?: { label: string; onPress: () => void } }) {
  const C = useColors();
  const color = tone === "error" ? C.danger : tone === "ok" ? C.success : C.ink500;
  return (
    <View className={`rounded-xl px-3 py-2.5 flex-row items-center gap-2 ${tone === "error" ? "bg-danger-soft" : "bg-ink-50"}`}>
      <Feather name={icon} size={13} color={color} />
      <Text className={`text-xs flex-1 ${tone === "error" ? "text-danger" : "text-ink-600"}`} numberOfLines={2}>{children}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} hitSlop={8} accessibilityRole="button">
          <Text className={`text-xs font-semibold ${tone === "error" ? "text-danger" : "text-black"}`}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function LocalStatus() {
  const C = useColors();
  const state = useAgentStore((s) => s.modelState);
  const progress = useAgentStore((s) => s.modelProgress);
  const error = useAgentStore((s) => s.modelError);
  const modelPath = useSettingsStore((s) => s.modelPath);

  if (!modelPath) {
    return <StatusRow icon="download" action={{ label: "Choose", onPress: () => router.push("/settings") }}>No on-device model yet — pick a GGUF file</StatusRow>;
  }
  if (state === "loading") {
    return (
      <View className="rounded-xl px-3 py-2.5 bg-ink-50">
        <View className="flex-row items-center gap-2 mb-2">
          <ActivityIndicator size="small" color={C.ink500} />
          <Text className="text-xs text-ink-600 flex-1" numberOfLines={1}>Loading {ggufName(modelPath)}… {progress}%</Text>
        </View>
        <View className="h-1.5 bg-ink-200 rounded-full overflow-hidden">
          <View className="h-full bg-black rounded-full" style={{ width: `${progress}%` }} />
        </View>
      </View>
    );
  }
  if (state === "error") {
    return (
      <StatusRow icon="alert-circle" tone="error" action={{ label: "Retry", onPress: () => { loadModel(modelPath).catch(() => {}); } }}>
        {error ? `Couldn't load model: ${error}` : "Couldn't load the model"}
      </StatusRow>
    );
  }
  if (state === "ready") {
    return <StatusRow icon="check-circle" tone="ok">{ggufName(modelPath)} · ready, private, offline</StatusRow>;
  }
  return <StatusRow icon="cpu">{ggufName(modelPath)} · starting…</StatusRow>;
}

function NimStatus({ hasKey }: { hasKey: boolean }) {
  const nimModel = useSettingsStore((s) => s.nimModel);
  const nimLargeModel = useSettingsStore((s) => s.nimLargeModel);
  if (!hasKey) {
    return <StatusRow icon="key" tone="error" action={{ label: "Add key", onPress: () => router.push("/settings") }}>NVIDIA NIM needs an API key</StatusRow>;
  }
  const tier = categorizeModel(nimModel).tier;
  const style = TIER_STYLE[tier];
  return (
    <TouchableOpacity onPress={() => router.push("/settings")} accessibilityRole="button" className="rounded-xl px-3 py-2.5 bg-ink-50 flex-row items-center gap-2">
      <Text className="text-xs text-ink-600 font-mono flex-1" numberOfLines={1}>
        {nimModel.split("/").pop() || "model"}
        {nimLargeModel ? ` · hard questions use ${nimLargeModel.split("/").pop()}` : ""}
      </Text>
      <View className={`px-1.5 py-0.5 rounded-full ${style?.bg ?? "bg-ink-200"}`}>
        <Text className={`text-[9px] font-semibold ${style?.text ?? "text-ink-500"}`}>{getTierLabel(tier)}</Text>
      </View>
    </TouchableOpacity>
  );
}

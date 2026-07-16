import { fetch as expoFetch } from "expo/fetch";
import { settingsStorage } from "@/stores/mmkv";

interface NimModelInfo {
  id: string;
  tier: "fast" | "balanced" | "smart" | "unknown";
  paramB?: number;
  family?: string;
}

function inferTier(id: string): NimModelInfo["tier"] {
  const lower = id.toLowerCase();
  const match = lower.match(/(\d+)[b]?/);
  const params = match ? parseInt(match[1], 10) : 0;

  if (params <= 0) return "unknown";
  if (params <= 2) return "fast";
  if (params <= 10) return "balanced";
  return "smart";
}

function extractParamB(id: string): number | undefined {
  const lower = id.toLowerCase();
  const match = lower.match(/(\d+)[b]/);
  if (match) return parseInt(match[1], 10);
  if (lower.includes("1b")) return 1;
  if (lower.includes("3b")) return 3;
  if (lower.includes("7b") || lower.includes("8b")) return 7;
  if (lower.includes("13b")) return 13;
  if (lower.includes("20b") || lower.includes("22b")) return 20;
  if (lower.includes("70b") || lower.includes("72b")) return 70;
  if (lower.includes("120b") || lower.includes("123b")) return 120;
  if (lower.includes("180b")) return 180;
  if (lower.includes("200b")) return 200;
  if (lower.includes("400b")) return 400;
  if (lower.includes("405b")) return 405;
  return undefined;
}

export function categorizeModel(id: string): NimModelInfo {
  return {
    id,
    tier: inferTier(id),
    paramB: extractParamB(id),
    family: id.split("/")[0] || "unknown",
  };
}

export function getTierLabel(tier: NimModelInfo["tier"]): string {
  switch (tier) {
    case "fast": return "Fast";
    case "balanced": return "Balanced";
    case "smart": return "Smart";
    default: return "Unknown";
  }
}

export function getTierColor(tier: NimModelInfo["tier"]): string {
  switch (tier) {
    case "fast": return "#22c55e";
    case "balanced": return "#f59e0b";
    case "smart": return "#ef4444";
    default: return "#999";
  }
}

function isSmallModelForTools(id: string): boolean {
  const info = categorizeModel(id);
  return info.tier === "fast" || info.tier === "balanced";
}

export function detectQueryComplexity(query: string): "tool" | "thinking" {
  const thinkingIndicators = [
    "analyze", "explain", "why", "how", "compare", "contrast",
    "summarize", "research", "investigate", "reason", "think",
    "plan", "strategy", "what if", "should i", "pros and cons",
    "evaluate", "assess", "review", "synthesize", "elaborate",
    "break down", "walk me through", "tell me about",
    "design", "architect", "brainstorm", "creative",
  ];
  const lower = query.toLowerCase();
  const matches = thinkingIndicators.filter((w) => lower.includes(w)).length;
  const wordCount = query.split(/\s+/).length;
  return matches >= 2 || wordCount > 30 ? "thinking" : "tool";
}

export function pickModelForTask(
  query: string,
  primaryModel: string,
  largeModel: string | null,
): string {
  const complexity = detectQueryComplexity(query);
  if (complexity === "thinking" && largeModel && largeModel !== primaryModel) {
    return largeModel;
  }
  return primaryModel;
}

interface AutoModelResult {
  models: string[];
  recommended: string;
  largeModel: string | null;
}

export function autoPickModels(availableModels: string[]): AutoModelResult {
  const categorized = availableModels.map(categorizeModel);
  const fastModels = categorized.filter((m) => m.tier === "fast");
  const balancedModels = categorized.filter((m) => m.tier === "balanced");
  const smartModels = categorized.filter((m) => m.tier === "smart");

  const recommended = fastModels[0]?.id
    || balancedModels[0]?.id
    || smartModels[0]?.id
    || availableModels[0]
    || "meta/llama-3.2-1b-instruct";

  const largeModel = smartModels[smartModels.length - 1]?.id
    || balancedModels[balancedModels.length - 1]?.id
    || null;

  return {
    models: availableModels,
    recommended,
    largeModel: largeModel !== recommended ? largeModel : null,
  };
}

export async function fetchNimModels(
  endpoint: string,
  apiKey: string,
): Promise<AutoModelResult> {
  const baseUrl = endpoint.trim().replace(/\/+$/, "");
  const res = await expoFetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as Record<string, unknown>;
  const modelIds: string[] = ((data.data || data.models || []) as Array<{ id?: string; model?: string }>)
    .map((m) => m.id || m.model)
    .filter(Boolean) as string[];
  return autoPickModels(modelIds);
}

export function cachedNimModels(): string[] {
  const raw = settingsStorage.getString("nimCachedModels");
  return raw ? JSON.parse(raw) : [];
}

export function cacheNimModels(models: string[]): void {
  settingsStorage.set("nimCachedModels", JSON.stringify(models));
}

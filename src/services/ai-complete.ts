import OpenAI from "openai";
import { useSettingsStore } from "@/stores/settings-store";
import { generateResponse, isModelLoaded } from "./local-llama";
import { createLogger } from "@/utils/logger";

const log = createLogger("ai");

/**
 * One-shot completion through whichever model is available: NVIDIA NIM when
 * a key is set, else the on-device model if loaded. Returns null when no
 * model is available or both fail, so callers can fall back to offline logic.
 */
export async function completeText(system: string, user: string, maxTokens = 1200): Promise<string | null> {
  const { apiKeys, nimEndpoint, nimModel } = useSettingsStore.getState();
  if (apiKeys.nim) {
    try {
      const client = new OpenAI({
        baseURL: (nimEndpoint || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, ""),
        apiKey: apiKeys.nim,
      });
      const res = await client.chat.completions.create({
        model: nimModel || "meta/llama-3.2-1b-instruct",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.1,
      });
      const text = res.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e) {
      log.warn("cloud completion failed", e);
    }
  }
  if (isModelLoaded()) {
    try {
      const text = (await generateResponse(`${system}\n\n${user}\n\nJSON:`)).trim();
      if (text) return text;
    } catch (e) {
      log.warn("local completion failed", e);
    }
  }
  return null;
}

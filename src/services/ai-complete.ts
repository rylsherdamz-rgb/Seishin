import OpenAI from "openai";
import { getNimKey, useSettingsStore } from "@/stores/settings-store";
import { useAgentStore } from "@/stores/agent-store";
import { chatWithTools, isModelLoaded } from "./local-llama";
import { createLogger } from "@/utils/logger";

const log = createLogger("ai");

/**
 * One-shot completion through the brain the user picked in the agent
 * (on-device by default), falling back to the other one. Returns null when no
 * model is available or both fail, so callers can fall back to offline logic.
 */
export async function completeText(system: string, user: string, maxTokens = 1200): Promise<string | null> {
  const order = useAgentStore.getState().currentProvider === "nim" ? [cloud, local] : [local, cloud];
  for (const run of order) {
    const text = await run(system, user, maxTokens);
    if (text) return text;
  }
  return null;
}

async function local(system: string, user: string): Promise<string | null> {
  if (!isModelLoaded()) return null;
  try {
    const { content } = await chatWithTools([{ role: "system", content: system }, { role: "user", content: user }], undefined);
    return content || null;
  } catch (e) {
    log.warn("local completion failed", e);
    return null;
  }
}

async function cloud(system: string, user: string, maxTokens: number): Promise<string | null> {
  const nimKey = await getNimKey();
  const { nimEndpoint, nimModel } = useSettingsStore.getState();
  if (!nimKey) return null;
  try {
    const client = new OpenAI({
      baseURL: (nimEndpoint || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, ""),
      apiKey: nimKey,
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
    return res.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    log.warn("cloud completion failed", e);
    return null;
  }
}

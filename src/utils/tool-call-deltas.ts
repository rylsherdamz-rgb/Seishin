/**
 * Streamed OpenAI-style tool calls arrive as fragments (id, name, and the JSON
 * arguments split across chunks). Pure so it can be unit-tested.
 */
import type { ToolCallData } from "@/stores/agent-store";

export interface ToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

type Partial = { id?: string; name?: string; arguments?: string };

/** Folds one chunk's `delta.tool_calls` into the running list. */
export function addToolCallDeltas(acc: Partial[], deltas: ToolCallDelta[]): void {
  for (const tc of deltas) {
    const idx = tc.index ?? 0;
    const cur = (acc[idx] ??= {});
    if (tc.id) cur.id = tc.id;
    if (tc.function?.name) cur.name = tc.function.name;
    if (tc.function?.arguments) cur.arguments = (cur.arguments ?? "") + tc.function.arguments;
  }
}

/**
 * Complete calls only. A tool without parameters may stream no arguments at
 * all, so that means "{}" (not "drop the call"), and a provider that omits ids
 * gets a stable one — the follow-up request rejects an undefined tool_call_id.
 */
export function finishToolCalls(acc: Partial[]): ToolCallData[] {
  return acc.flatMap((t, i) => (t?.name ? [{ id: t.id || `call_${i}`, name: t.name, arguments: t.arguments?.trim() || "{}" }] : []));
}

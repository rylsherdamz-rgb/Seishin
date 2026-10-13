/**
 * The on-device agent: the GGUF model loaded by llama.rn plans and calls the
 * same tools as the cloud (NVIDIA NIM) agent — add/list/edit events, tasks,
 * notes, inbox and memory — with no network at all.
 *
 * The phone model has a small context (4096 tokens), so it gets a compact
 * system prompt and the everyday tool set (LOCAL_TOOL_NAMES) rather than the
 * full cloud prompt.
 */
import { useAgentStore, type AgentMessage } from "@/stores/agent-store";
import { useSettingsStore } from "@/stores/settings-store";
import { uid } from "@/utils/id";
import { createLogger } from "@/utils/logger";
import { chatWithTools, generationAborted, type LocalChatMessage } from "./local-llama";
import { retrieveRelevantContext, retrieveRelevantMemory } from "./retriever";
import { getGraphSummary } from "./agent-memory";
import { buildConversation, createDefaultTools, executeToolCalls, LOCAL_TOOL_NAMES } from "./agent-engine";

const log = createLogger("local-agent");

/** Model → tools → model rounds per request (RULES: agent loop ≤ 10). */
export const MAX_LOCAL_STEPS = 4;
const HISTORY = 8;
const CONTEXT_CHARS = 1500;

export function localModelName(): string {
  const path = useSettingsStore.getState().modelPath;
  return path ? (path.split("/").pop() ?? "").replace(/\.gguf$/i, "") : "on-device model";
}

export function createLocalSystemPrompt(extra: string): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const context = extra.trim() ? `\n\nWhat you know:\n${extra.slice(0, CONTEXT_CHARS)}` : "";
  return `You are Seishin, an assistant running fully on the user's phone, offline.
Today is ${date}, ${time}.
Use the tools to add, read, change or delete the user's events, tasks and notes, and to remember facts about them.
- When the user asks for an action, call the tool right away. Never ask permission.
- "task", "todo", "homework", "deadline" → add_todo. "meeting", "event", "at <time>" → add_event. "note", "write down" → add_note.
- Resolve "tomorrow", "next Friday" etc. from today's date.
- After tools run, reply in one or two short sentences. If no tool fits, just answer.${context}`;
}

/** Cloud-format history → the on-device chat format. */
export function toLocalMessages(history: AgentMessage[]): LocalChatMessage[] {
  return buildConversation(history).map((m) => {
    const out: LocalChatMessage = {
      role: m.role as LocalChatMessage["role"],
      content: typeof m.content === "string" ? m.content : "",
    };
    if (m.role === "assistant" && m.tool_calls?.length) {
      out.tool_calls = m.tool_calls.flatMap((c) =>
        c.type === "function" ? [{ id: c.id, type: "function" as const, function: { name: c.function.name, arguments: c.function.arguments } }] : [],
      );
    }
    if (m.role === "tool") out.tool_call_id = m.tool_call_id;
    return out;
  });
}

function buildLocalConversation(userInput: string, extractedContext?: string): LocalChatMessage[] {
  const known = [retrieveRelevantContext(userInput), retrieveRelevantMemory(userInput), getGraphSummary()]
    .filter(Boolean)
    .join("\n\n");
  const history = toLocalMessages(useAgentStore.getState().messages.slice(-HISTORY));
  // The cut may land mid tool-exchange; chat templates reject a tool result
  // without its call, so start the history at a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  if (extractedContext) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role !== "user") continue;
      history[i] = { role: "user", content: `${history[i].content}\n\n[Attached content]\n${extractedContext}`.trim() };
      break;
    }
  }
  return [{ role: "system", content: createLocalSystemPrompt(known) }, ...history];
}

/**
 * One user request on the on-device model. Streams each reply into the chat,
 * runs any tool calls, and feeds results back until the model answers in
 * plain text (or the step limit is reached). Returns the final reply.
 */
export async function runLocalAgent(userInput: string, extractedContext?: string): Promise<string> {
  const store = useAgentStore.getState();
  const model = localModelName();
  const toolParams = createDefaultTools().toParams().filter((t) => t.type === "function" && LOCAL_TOOL_NAMES.includes(t.function.name));
  const conversation = buildLocalConversation(userInput, extractedContext);

  for (let step = 0; step < MAX_LOCAL_STEPS; step++) {
    const msgId = uid("local");
    store.addMessage({ id: msgId, role: "assistant", content: "", timestamp: new Date().toISOString(), provider: "local", model });
    // Last round: no tools, so the model must answer in words.
    const offerTools = step < MAX_LOCAL_STEPS - 1 ? toolParams : undefined;
    let content: string;
    let toolCalls: Awaited<ReturnType<typeof chatWithTools>>["toolCalls"];
    try {
      ({ content, toolCalls } = await chatWithTools(conversation, offerTools, (text) => store.updateAssistantMessage(msgId, text)));
    } catch (e) {
      // Reuse this step's bubble for the error instead of leaving it empty.
      const reply = `Error: ${e instanceof Error ? e.message : "the on-device model failed"}`;
      log.warn("local step failed", e);
      store.updateAssistantMessage(msgId, reply);
      return reply;
    }

    // Stopped by the user: keep what was written, run nothing.
    if (generationAborted()) return content;

    if (toolCalls.length === 0) {
      const reply = content || "Done.";
      store.updateAssistantMessage(msgId, reply);
      return reply;
    }

    log.debug(`step ${step}: ${toolCalls.map((c) => c.name).join(", ")}`);
    store.updateAssistantMessage(msgId, content, toolCalls);
    const results = await executeToolCalls(toolCalls);
    // Stop pressed while the tools ran: don't start another model round.
    if (generationAborted()) return content;
    conversation.push(
      { role: "assistant", content, tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: c.arguments } })) },
      ...toolCalls.map((c, i) => ({ role: "tool" as const, content: results[i] ?? "", tool_call_id: c.id })),
    );
  }
  return "Done.";
}

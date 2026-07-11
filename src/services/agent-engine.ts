import OpenAI from "openai";
import { fetch as expoFetch } from "expo/fetch";
import { useAgentStore, AgentMessage } from "@/stores/agent-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useInvitesStore } from "@/stores/invites-store";
import { BaseTool, ToolCollection, ToolResult } from "./tool-system";

let currentAbort: AbortController | null = null;

export function stopAgentLoop() {
  currentAbort?.abort();
  currentAbort = null;
  useAgentStore.getState().setProcessing(false);
}

class AddEventTool extends BaseTool {
  name = "add_event";
  description = "Add an event to the calendar";
  parameters = {
    title: { type: "string", description: "Event title" },
    startDate: { type: "string", description: "Start date/time in ISO format (e.g. 2024-03-15T14:00:00.000Z)" },
    endDate: { type: "string", description: "End date/time in ISO format", optional: true },
    description: { type: "string", description: "Optional event description", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { addEvent } = useCalendarStore.getState();
    const event = {
      id: `ai-${Date.now()}`,
      title: (args.title as string) || "Untitled",
      startDate: (args.startDate as string) || new Date().toISOString(),
      endDate: (args.endDate as string) || new Date(Date.now() + 3600000).toISOString(),
      source: "ai" as const,
      description: args.description as string | undefined,
    };
    addEvent(event);
    return this.successResponse(`Added event: "${event.title}" on ${new Date(event.startDate).toLocaleString()}`);
  }
}

class ListEventsTool extends BaseTool {
  name = "list_events";
  description = "List all calendar events";
  parameters = {};

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    const { events } = useCalendarStore.getState();
    if (events.length === 0) return this.successResponse("No events found.");
    const sorted = [...events].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    const lines = sorted.map((e) =>
      `- ${e.title} (${new Date(e.startDate).toLocaleDateString()} ${new Date(e.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
    );
    return this.successResponse(lines.join("\n"));
  }
}

class AddTodoTool extends BaseTool {
  name = "add_todo";
  description = "Add a todo item with optional due date";
  parameters = {
    title: { type: "string", description: "Todo title" },
    priority: { type: "string", description: "Priority: low, medium, or high", optional: true },
    dueDate: { type: "string", description: "Optional due date in ISO format", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { addTodo } = useTodoStore.getState();
    addTodo({
      id: `ai-${Date.now()}`,
      title: (args.title as string) || "Untitled",
      priority: (args.priority as "low" | "medium" | "high") || "medium",
      completed: false,
      category: "general",
      tags: [],
      createdAt: new Date().toISOString(),
      dueDate: args.dueDate as string | undefined,
    });
    let msg = `Added todo: "${args.title}"`;
    if (args.dueDate) msg += ` (due: ${new Date(args.dueDate as string).toLocaleDateString()})`;
    return this.successResponse(msg);
  }
}

class ListTodosTool extends BaseTool {
  name = "list_todos";
  description = "List all active todos";
  parameters = {};

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    const { todos } = useTodoStore.getState();
    const active = todos.filter((t) => !t.completed);
    if (active.length === 0) return this.successResponse("No active todos.");
    const lines = active.map((t) => {
      let s = `- ${t.title} [${t.priority}]`;
      if (t.dueDate) s += ` due ${new Date(t.dueDate).toLocaleDateString()}`;
      return s;
    });
    return this.successResponse(lines.join("\n"));
  }
}

class GenerateInviteTool extends BaseTool {
  name = "generate_invite";
  description = "Generate a P2P invite code";
  parameters = {
    title: { type: "string", description: "Title for the invite" },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { generateP2pCode, addInvite } = useInvitesStore.getState();
    const code = generateP2pCode();
    addInvite({
      id: `p2p-${Date.now()}`,
      type: "p2p-code",
      title: (args.title as string) || "P2P Invite",
      status: "active",
      code,
      createdAt: new Date().toISOString(),
      data: {},
    });
    return this.successResponse(`Generated invite code: ${code}`);
  }
}

class GetSettingsTool extends BaseTool {
  name = "get_settings";
  description = "Get current app settings and status";
  parameters = {};

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    const state = useSettingsStore.getState();
    const todoStats = useTodoStore.getState().getStats();
    const calEvents = useCalendarStore.getState().events;
    const lines = [
      `AI: ${state.apiKeys.nim ? "NVIDIA NIM connected" : "local only"}`,
      `Events: ${calEvents.length} total`,
      `Todos: ${todoStats.active} active, ${todoStats.completed} done`,
      `Cleanup: notifications=${state.cleanupPolicies.notificationsDays}d, emails=${state.cleanupPolicies.emailsDays}d`,
    ];
    return this.successResponse(lines.join("\n"));
  }
}

export function createDefaultTools(): ToolCollection {
  return new ToolCollection(
    new AddEventTool(),
    new ListEventsTool(),
    new AddTodoTool(),
    new ListTodosTool(),
    new GenerateInviteTool(),
    new GetSettingsTool(),
  );
}

export function createSystemPrompt(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `You are Seishin, a helpful AI assistant on the user's phone. You help with scheduling, todos, reminders, planning, advice, and general questions.

Current date and time: ${dateStr} at ${timeStr}

## PRIORITIES (in order)

1. SCHEDULE & TASK ACTIONS — HIGHEST PRIORITY.
   When the user wants to create, add, schedule, book, plan, or be reminded of anything task- or time-related, you MUST call the matching tool directly (do not write code, do not merely describe it), then briefly confirm what you did.
   - add_todo — tasks, todos, assignments, homework, reminders, deadlines.
   - add_event — calendar events, meetings, appointments, and time-blocked activities.
   - list_events — read saved calendar events.
   - list_todos — read saved tasks.
   - generate_invite — create an invite code.
   - get_settings — report the current setup.

2. ANSWER & CONVERSE — for questions, explanations, advice, or plans the user only wants to read, respond naturally in plain language. No tool call.

3. CODE — only write code when the user explicitly asks for it. Never use code to add a todo or event; use the tools.

## RULES
- CRITICAL: Build every tool argument from the USER'S ACTUAL MESSAGE — the real subject the user wrote. Never invent or reuse an unrelated title.
- The user often types with typos, poor grammar, missing words, or shorthand. Interpret their intent charitably and proceed anyway — do NOT ask them to rephrase. Silently correct spelling/grammar and write a clean, well-formed, properly-capitalized title. If the intent is genuinely unclear, make your best reasonable guess and state the assumption briefly.
- Tool choice by wording: if the user says "todo", "task", "assignment", "homework", "reminder", or "to-do" → use add_todo. If they say "event", "meeting", "appointment", or "schedule at <time>" → use add_event. When unsure, use add_todo for things to DO and add_event for things happening at a set time.
- Resolve relative dates from the current date/time above ("next week", "tomorrow at 6pm", "next Friday" → a correct ISO datetime).
- Only "title" is required for add_todo; only "title" and "startDate" for add_event. Infer the rest.
- Emit the tool call immediately; don't ask for confirmation unless the request is truly ambiguous.
- You cannot browse the internet. If asked for live/web info, say so briefly and answer from your knowledge.
- MULTIPLE ITEMS: if the user asks to plan a whole day or gives several activities at once, create a SEPARATE tool call for EACH activity — call add_event/add_todo once per item, with sensible non-overlapping time blocks for a day plan. Never merge several activities into one item.`;
}

function buildConversation(messages: AgentMessage[]): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      result.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      if (m.toolCalls && m.toolCalls.length > 0) {
        result.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });
      } else {
        result.push({ role: "assistant", content: m.content });
      }
    } else if (m.role === "tool" && m.toolCallId) {
      result.push({
        role: "tool",
        tool_call_id: m.toolCallId,
        content: m.content,
      });
    }
  }
  return result;
}

async function streamResponse(
  openai: OpenAI,
  model: string,
  messages: OpenAI.ChatCompletionMessageParam[],
  tools: OpenAI.ChatCompletionTool[] | undefined,
  msgId: string,
): Promise<string> {
  const agentStore = useAgentStore.getState();

  if (currentAbort?.signal.aborted) return "";

  const stream = await openai.chat.completions.create(
    {
      model,
      messages,
      tools,
      tool_choice: tools ? "auto" : undefined,
      stream: true,
    },
    { signal: currentAbort?.signal },
  );

  let fullContent = "";
  const toolCallDeltas: { id?: string; name?: string; arguments?: string }[] = [];

  for await (const chunk of stream) {
    if (currentAbort?.signal.aborted) break;

    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      fullContent += delta.content;
      agentStore.updateAssistantMessage(msgId, fullContent);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index || 0;
        if (!toolCallDeltas[idx]) toolCallDeltas[idx] = {};
        if (tc.id) toolCallDeltas[idx].id = tc.id;
        if (tc.function?.name) toolCallDeltas[idx].name = tc.function.name;
        if (tc.function?.arguments) {
          toolCallDeltas[idx].arguments = (toolCallDeltas[idx].arguments || "") + tc.function.arguments;
        }
      }
    }
  }

  const toolCalls = toolCallDeltas
    .filter((t) => t.name && t.arguments)
    .map((t) => ({
      id: t.id!,
      name: t.name!,
      arguments: t.arguments!,
    }));

  if (toolCalls.length > 0) {
    agentStore.updateAssistantMessage(msgId, fullContent, toolCalls);

    const tools = createDefaultTools();
    const summary: string[] = [];
    for (const call of toolCalls) {
      const tool = tools.getTool(call.name);
      if (!tool) continue;
      try {
        const args = JSON.parse(call.arguments);
        console.log(`[Agent] Executing tool: ${call.name}`, args);
        const result = await tool.executeWithString(args);
        summary.push(result);
        agentStore.addMessage({
          id: `tool-${Date.now()}`,
          role: "tool",
          content: result,
          timestamp: new Date().toISOString(),
          toolName: call.name,
          toolCallId: call.id,
        });
      } catch (e) {
        const errMsg = `Tool ${call.name} error: ${e instanceof Error ? e.message : "Unknown"}`;
        summary.push(errMsg);
        agentStore.addMessage({
          id: `tool-err-${Date.now()}`,
          role: "tool",
          content: errMsg,
          timestamp: new Date().toISOString(),
          toolName: call.name,
          toolCallId: call.id,
        });
      }
    }

    const resultContent = summary.join("\n");
    // Keep the assistant's own text (fullContent) and its recorded toolCalls.
    // Tool results are already shown as separate tool messages, so do NOT
    // overwrite the assistant message content here (that erased the reply).
    return resultContent;
  }

  return fullContent;
}

export async function runAgentLoop(userInput: string) {
  const agentStore = useAgentStore.getState();
  const { apiKeys, nimEndpoint, nimModel } = useSettingsStore.getState();
  const { currentProvider } = agentStore;

  if (currentProvider === "local") {
    agentStore.addMessage({
      id: `msg-${Date.now()}`,
      role: "user",
      content: userInput,
      timestamp: new Date().toISOString(),
    });
    agentStore.setProcessing(false);
    agentStore.addMessage({
      id: `msg-${Date.now()}-local`,
      role: "assistant",
      content: "Local GGUF mode not yet available. Switch to NVIDIA NIM or configure a GGUF model.",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const userMsg: AgentMessage = {
    id: `msg-${Date.now()}`,
    role: "user",
    content: userInput,
    timestamp: new Date().toISOString(),
  };
  agentStore.addMessage(userMsg);
  agentStore.setProcessing(true);
  currentAbort = new AbortController();
  // Safety timeout: never leave the UI stuck on "thinking" if the model or
  // network stalls. Aborts the request after 60s.
  const timeoutId = setTimeout(() => currentAbort?.abort(), 60000);

  try {
    if (!apiKeys.nim) {
      throw new Error("No API key configured. Add your NVIDIA NIM API key in Settings.");
    }

    const openai = new OpenAI({
      baseURL: nimEndpoint,
      apiKey: apiKeys.nim,
      // React Native's built-in fetch cannot read streaming response bodies,
      // which makes the OpenAI SDK throw "Connection error" on stream:true.
      // Expo's fetch supports streaming, so use it here.
      fetch: expoFetch as unknown as typeof fetch,
      dangerouslyAllowBrowser: true,
    });

    const tools = createDefaultTools();
    const toolParams = tools.toParams();

    // Read the CURRENT store state — agentStore was captured before addMessage,
    // so agentStore.messages is stale and would omit the message just sent
    // (causing the AI to answer the previous prompt — a one-message lag).
    const history = useAgentStore.getState().messages.slice(-20);
    const conversation: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: createSystemPrompt() },
      ...buildConversation(history),
    ];

    console.log(`[Agent] Streaming to NIM model=${nimModel} msgs=${conversation.length} tools=${toolParams.length}`);

    const msgId = `msg-${Date.now()}-asst`;
    agentStore.addMessage({
      id: msgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    });

    await streamResponse(openai, nimModel, conversation, toolParams, msgId);
  } catch (e) {
    console.error("[Agent] Error:", e);
    const errorMsg = e instanceof Error ? e.message : "Unknown error occurred";
    agentStore.addMessage({
      id: `msg-${Date.now()}-err`,
      role: "assistant",
      content: errorMsg,
      timestamp: new Date().toISOString(),
    });
  } finally {
    clearTimeout(timeoutId);
    agentStore.setProcessing(false);
    currentAbort = null;
  }
}

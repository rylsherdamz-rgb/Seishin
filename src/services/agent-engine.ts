import OpenAI from "openai";
import { useAgentStore, AgentMessage } from "@/stores/agent-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useInvitesStore } from "@/stores/invites-store";

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  execute: (args: Record<string, string>) => Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  toOpenAITools(): OpenAI.ChatCompletionTool[] {
    return this.list().map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(t.parameters).map(([key, val]) => [
              key,
              { type: val.type, description: val.description },
            ])
          ),
          required: Object.keys(t.parameters),
        },
      },
    }));
  }
}

export function createDefaultTools(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: "add_event",
    description: "Add an event to the calendar",
    parameters: {
      title: { type: "string", description: "Event title" },
      startDate: { type: "string", description: "Start date/time in ISO format (e.g. 2024-03-15T14:00:00.000Z)" },
      endDate: { type: "string", description: "End date/time in ISO format" },
      description: { type: "string", description: "Optional event description" },
    },
    execute: async (args) => {
      const { addEvent } = useCalendarStore.getState();
      const event = {
        id: `ai-${Date.now()}`,
        title: args.title || "Untitled",
        startDate: args.startDate || new Date().toISOString(),
        endDate: args.endDate || new Date(Date.now() + 3600000).toISOString(),
        source: "ai" as const,
        description: args.description,
      };
      addEvent(event);
      return `Added event: "${event.title}" on ${new Date(event.startDate).toLocaleString()}`;
    },
  });

  registry.register({
    name: "list_events",
    description: "List all calendar events",
    parameters: {},
    execute: async () => {
      const { events } = useCalendarStore.getState();
      if (events.length === 0) return "No events found.";
      return events
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .map((e) => `- ${e.title} (${new Date(e.startDate).toLocaleDateString()} ${new Date(e.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`)
        .join("\n");
    },
  });

  registry.register({
    name: "add_todo",
    description: "Add a todo item with optional due date",
    parameters: {
      title: { type: "string", description: "Todo title" },
      priority: { type: "string", description: "Priority: low, medium, or high" },
      dueDate: { type: "string", description: "Optional due date in ISO format" },
    },
    execute: async (args) => {
      const { addTodo } = useTodoStore.getState();
      addTodo({
        id: `ai-${Date.now()}`,
        title: args.title || "Untitled",
        priority: (args.priority as "low" | "medium" | "high") || "medium",
        completed: false,
        category: "general",
        tags: [],
        createdAt: new Date().toISOString(),
        dueDate: args.dueDate,
      });
      let msg = `Added todo: "${args.title}"`;
      if (args.dueDate) msg += ` (due: ${new Date(args.dueDate).toLocaleDateString()})`;
      return msg;
    },
  });

  registry.register({
    name: "list_todos",
    description: "List all active todos",
    parameters: {},
    execute: async () => {
      const { todos } = useTodoStore.getState();
      const active = todos.filter((t) => !t.completed);
      if (active.length === 0) return "No active todos.";
      return active.map((t) => {
        let s = `- ${t.title} [${t.priority}]`;
        if (t.dueDate) s += ` due ${new Date(t.dueDate).toLocaleDateString()}`;
        return s;
      }).join("\n");
    },
  });

  registry.register({
    name: "generate_invite",
    description: "Generate a P2P invite code",
    parameters: {
      title: { type: "string", description: "Title for the invite" },
    },
    execute: async (args) => {
      const { generateP2pCode, addInvite } = useInvitesStore.getState();
      const code = generateP2pCode();
      addInvite({
        id: `p2p-${Date.now()}`,
        type: "p2p-code",
        title: args.title || "P2P Invite",
        status: "active" as const,
        code,
        createdAt: new Date().toISOString(),
        data: {},
      });
      return `Generated invite code: ${code}`;
    },
  });

  registry.register({
    name: "get_settings",
    description: "Get current app settings and status",
    parameters: {},
    execute: async () => {
      const state = useSettingsStore.getState();
      const todoStats = useTodoStore.getState().getStats();
      const calEvents = useCalendarStore.getState().events;
      return [
        `AI: ${state.apiKeys.nim ? "NVIDIA NIM connected" : "local only"}`,
        `Events: ${calEvents.length} total`,
        `Todos: ${todoStats.active} active, ${todoStats.completed} done`,
        `Cleanup: notifications=${state.cleanupPolicies.notificationsDays}d, emails=${state.cleanupPolicies.emailsDays}d`,
      ].join("\n");
    },
  });

  return registry;
}

function getMondayBasedWeek(date: Date): string {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split("T")[0];
}

export function createSystemPrompt(registry: ToolRegistry): string {
  return `You are Seishin, an AI assistant on a mobile device. You manage the user's schedule, todos, and life organization.

Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

You have tools to manage events and todos. ALWAYS use the appropriate tool when the user asks you to:
- Create an event → call add_event
- List events → call list_events
- Add a task → call add_todo
- List tasks → call list_todos
- Generate invite → call generate_invite

Be concise. After using a tool, confirm what was done.`;
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

  const stream = await openai.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: tools ? "auto" : undefined,
    stream: true,
  });

  let fullContent = "";
  let toolCallDeltas: { id?: string; name?: string; arguments?: string }[] = [];

  for await (const chunk of stream) {
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

    const registry = createDefaultTools();
    for (const call of toolCalls) {
      const tool = registry.get(call.name);
      if (!tool) continue;
      try {
        const args = JSON.parse(call.arguments);
        console.log(`[Agent] Executing tool: ${call.name}`, args);
        const result = await tool.execute(args);
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

    const followMsgs: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: createSystemPrompt(createDefaultTools()) },
      ...buildConversation(agentStore.messages.slice(-20)),
    ];

    const followMsgId = `msg-${Date.now()}-resp`;
    agentStore.addMessage({
      id: followMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    });

    return streamResponse(openai, model, followMsgs, undefined, followMsgId);
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

  try {
    if (!apiKeys.nim) {
      throw new Error("No API key configured. Add your NVIDIA NIM API key in Settings.");
    }

    const openai = new OpenAI({
      baseURL: nimEndpoint,
      apiKey: apiKeys.nim,
    });

    const registry = createDefaultTools();
    const tools = registry.toOpenAITools();

    const history = agentStore.messages.slice(-20);
    const conversation: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: createSystemPrompt(registry) },
      ...buildConversation(history),
    ];

    console.log(`[Agent] Streaming to NIM model=${nimModel} msgs=${conversation.length} tools=${tools.length}`);

    const msgId = `msg-${Date.now()}-asst`;
    agentStore.addMessage({
      id: msgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    });

    await streamResponse(openai, nimModel, conversation, tools, msgId);
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
    agentStore.setProcessing(false);
  }
}

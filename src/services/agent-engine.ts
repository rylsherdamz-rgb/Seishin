import { useAgentStore, AgentMessage } from "@/stores/agent-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useInvitesStore } from "@/stores/invites-store";

export interface Tool {
  name: string;
  description: string;
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

  describe(): string {
    return this.list()
      .map((t) => `  - ${t.name}: ${t.description}`)
      .join("\n");
  }
}

export function createDefaultTools(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: "add_event",
    description: "Add an event to the calendar. Params: title, startDate, endDate (ISO), description (optional)",
    execute: async (args) => {
      const { addEvent } = useCalendarStore.getState();
      const event = {
        id: `ai-${Date.now()}`,
        title: args.title || "Untitled",
        startDate: args.startDate || new Date().toISOString(),
        endDate: args.endDate || new Date().toISOString(),
        source: "ai" as const,
        description: args.description,
      };
      addEvent(event);
      return `Added event: ${event.title}`;
    },
  });

  registry.register({
    name: "list_events",
    description: "List all calendar events",
    execute: async () => {
      const { events } = useCalendarStore.getState();
      if (events.length === 0) return "No events found.";
      return events.map((e) => `- ${e.title} (${new Date(e.startDate).toLocaleDateString()})`).join("\n");
    },
  });

  registry.register({
    name: "add_todo",
    description: "Add a todo item. Params: title, priority (low/medium/high), dueDate (ISO, optional)",
    execute: async (args) => {
      const { addTodo } = useTodoStore.getState();
      addTodo({
        id: `ai-${Date.now()}`,
        title: args.title || "Untitled",
        priority: (args.priority as any) || "medium",
        completed: false,
        category: "general",
        tags: [],
        createdAt: new Date().toISOString(),
        dueDate: args.dueDate,
      });
      return `Added todo: ${args.title}`;
    },
  });

  registry.register({
    name: "list_todos",
    description: "List all active todos",
    execute: async () => {
      const { todos } = useTodoStore.getState();
      const active = todos.filter((t) => !t.completed);
      if (active.length === 0) return "No active todos.";
      return active.map((t) => `- ${t.title} [${t.priority}]`).join("\n");
    },
  });

  registry.register({
    name: "generate_invite",
    description: "Generate a P2P invite code. Params: title",
    execute: async (args) => {
      const { generateP2pCode } = useInvitesStore.getState();
      const code = generateP2pCode();
      return `Generated invite code: ${code}`;
    },
  });

  registry.register({
    name: "get_settings",
    description: "Get current settings information",
    execute: async () => {
      const state = useSettingsStore.getState();
      return `Provider: ${state.apiKeys.nim ? "NVIDIA NIM configured" : "local only"}\nCleanup: notifications=${state.cleanupPolicies.notificationsDays}d, emails=${state.cleanupPolicies.emailsDays}d, chat=${state.cleanupPolicies.chatDays}d`;
    },
  });

  return registry;
}

export function createSystemPrompt(registry: ToolRegistry): string {
  return `You are Seishin, a helpful AI assistant running on a mobile device.
You help users manage their schedule, todos, and life organization.

You have access to the following tools:
${registry.describe()}

Current date: ${new Date().toLocaleDateString()}
Be concise. Use tools when appropriate. If you can't help with something, say so.`;
}

import * as OpenAI from "openai";

export async function runAgentLoop(userInput: string) {
  const store = useAgentStore.getState();
  const { apiKeys } = useSettingsStore.getState();
  const registry = createDefaultTools();

  store.addMessage({ id: `msg-${Date.now()}`, role: "user", content: userInput, timestamp: new Date().toISOString() });
  store.setProcessing(true);

  try {
    let response = "";

    if (apiKeys.nim) {
      const openai = new OpenAI.OpenAI({ baseURL: "https://integrate.api.nvidia.com/v1", apiKey: apiKeys.nim });
      const completion = await openai.chat.completions.create({
        model: "meta/llama-3.2-3b-instruct",
        messages: [
          { role: "system", content: createSystemPrompt(registry) },
          ...store.messages.slice(-10).map((m) => ({ role: m.role === "tool" ? "assistant" as const : m.role as "user" | "assistant", content: m.content })),
        ],
      });
      response = completion.choices[0]?.message?.content || "No response generated.";
    } else {
      response = "AI agent requires an API key (NVIDIA NIM) or a local GGUF model. Configure in Settings.";
    }

    store.addMessage({ id: `msg-${Date.now()}-resp`, role: "assistant", content: response, timestamp: new Date().toISOString() });
    return response;
  } catch (e) {
    const errorMsg = `Error: ${e instanceof Error ? e.message : "Unknown error"}`;
    store.addMessage({ id: `msg-${Date.now()}-err`, role: "assistant", content: errorMsg, timestamp: new Date().toISOString() });
    return errorMsg;
  } finally {
    store.setProcessing(false);
  }
}

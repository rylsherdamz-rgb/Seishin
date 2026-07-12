import { AppState } from "react-native";
import OpenAI from "openai";
import { fetch as expoFetch } from "expo/fetch";
import * as Notifications from "expo-notifications";
import { useAgentStore, AgentMessage, AgentAttachment } from "@/stores/agent-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useNotesStore } from "@/stores/notes-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useInvitesStore } from "@/stores/invites-store";
import { BaseTool, ToolCollection, ToolResult } from "./tool-system";
import { uid } from "@/utils/id";
import {
  addEntity, addRelation, queryGraph, listEntities, getGraphSummary,
  appendToSessionLog, getSessionLog, getRelated, findPath,
  updateEntity, deleteEntity, deleteRelation,
} from "./agent-memory";

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
    notes: { type: "string", description: "Optional freeform notes for the event", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { addEvent } = useCalendarStore.getState();
    const event = {
      id: uid("ai-evt"),
      title: (args.title as string) || "Untitled",
      startDate: (args.startDate as string) || new Date().toISOString(),
      endDate: (args.endDate as string) || new Date(Date.now() + 3600000).toISOString(),
      source: "ai" as const,
      description: args.description as string | undefined,
      notes: args.notes as string | undefined,
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
      `- [id:${e.id}] ${e.title} (${new Date(e.startDate).toLocaleDateString()} ${new Date(e.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
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
      id: uid("ai-todo"),
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
  description = "List todos. By default lists active (not done) todos; set includeCompleted to also show finished ones.";
  parameters = {
    includeCompleted: { type: "boolean", description: "Include completed todos in the list", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { todos } = useTodoStore.getState();
    const includeCompleted = args.includeCompleted === true || args.includeCompleted === "true";
    const list = includeCompleted ? todos : todos.filter((t) => !t.completed);
    if (list.length === 0) return this.successResponse("No todos found.");
    const lines = list.map((t) => {
      let s = `- [id:${t.id}] ${t.title} [${t.priority}]`;
      if (t.dueDate) s += ` due ${new Date(t.dueDate).toLocaleDateString()}`;
      s += t.completed ? " (done)" : "";
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
      id: uid("p2p"),
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

/**
 * Find a single item by exact id or a case-insensitive title match.
 * Returns { item } on a unique match, or { error } describing the problem
 * (nothing found, or several candidates that the AI should disambiguate).
 */
function findByIdOrTitle<T extends { id: string; title: string }>(
  items: T[],
  opts: { id?: string; query?: string },
  label: string,
): { item?: T; error?: string } {
  const id = opts.id?.trim();
  const query = opts.query?.trim();

  if (id) {
    const byId = items.find((i) => i.id === id);
    if (byId) return { item: byId };
  }

  if (query) {
    const q = query.toLowerCase();
    const exact = items.filter((i) => i.title.toLowerCase() === q);
    const matches = exact.length > 0 ? exact : items.filter((i) => i.title.toLowerCase().includes(q));
    if (matches.length === 1) return { item: matches[0] };
    if (matches.length === 0) return { error: `No ${label} found matching "${query}".` };
    const names = matches.map((m) => `"${m.title}" [id:${m.id}]`).join(", ");
    return { error: `Multiple ${label}s match "${query}": ${names}. Ask which one or pass its id.` };
  }

  return { error: `Provide an id or a title query to identify the ${label}.` };
}

class UpdateEventTool extends BaseTool {
  name = "update_event";
  description = "Edit an existing calendar event. Identify it by id or by its current title (query), then change any of title, start/end time, or description.";
  parameters = {
    query: { type: "string", description: "Current title (or part of it) of the event to edit", optional: true },
    id: { type: "string", description: "Exact event id, if known", optional: true },
    title: { type: "string", description: "New title", optional: true },
    startDate: { type: "string", description: "New start date/time in ISO format", optional: true },
    endDate: { type: "string", description: "New end date/time in ISO format", optional: true },
    description: { type: "string", description: "New description", optional: true },
    notes: { type: "string", description: "New freeform notes for the event", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { events, updateEvent } = useCalendarStore.getState();
    const { item, error } = findByIdOrTitle(events, { id: args.id as string, query: args.query as string }, "event");
    if (error || !item) return this.failResponse(error || "Event not found.");

    const changes: Record<string, unknown> = {};
    if (typeof args.title === "string") changes.title = args.title;
    if (typeof args.startDate === "string") changes.startDate = args.startDate;
    if (typeof args.endDate === "string") changes.endDate = args.endDate;
    if (typeof args.description === "string") changes.description = args.description;
    if (typeof args.notes === "string") changes.notes = args.notes;
    if (Object.keys(changes).length === 0) return this.failResponse("No changes provided.");

    updateEvent(item.id, changes);
    return this.successResponse(`Updated event "${(changes.title as string) || item.title}".`);
  }
}

class DeleteEventTool extends BaseTool {
  name = "delete_event";
  description = "Delete/remove a calendar event, identified by id or by its title (query).";
  parameters = {
    query: { type: "string", description: "Title (or part of it) of the event to delete", optional: true },
    id: { type: "string", description: "Exact event id, if known", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { events, deleteEvent } = useCalendarStore.getState();
    const { item, error } = findByIdOrTitle(events, { id: args.id as string, query: args.query as string }, "event");
    if (error || !item) return this.failResponse(error || "Event not found.");
    deleteEvent(item.id);
    return this.successResponse(`Deleted event "${item.title}".`);
  }
}

class CompleteTodoTool extends BaseTool {
  name = "complete_todo";
  description = "Mark a todo as done (or reopen it), identified by id or by its title (query).";
  parameters = {
    query: { type: "string", description: "Title (or part of it) of the todo", optional: true },
    id: { type: "string", description: "Exact todo id, if known", optional: true },
    done: { type: "boolean", description: "true to mark done (default), false to reopen it", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { todos, updateTodo } = useTodoStore.getState();
    const { item, error } = findByIdOrTitle(todos, { id: args.id as string, query: args.query as string }, "todo");
    if (error || !item) return this.failResponse(error || "Todo not found.");

    const done = !(args.done === false || args.done === "false");
    updateTodo(item.id, {
      completed: done,
      completedAt: done ? new Date().toISOString() : undefined,
    });
    return this.successResponse(`Marked todo "${item.title}" as ${done ? "done" : "not done"}.`);
  }
}

class UpdateTodoTool extends BaseTool {
  name = "update_todo";
  description = "Edit an existing todo. Identify it by id or by its current title (query), then change title, priority, or due date.";
  parameters = {
    query: { type: "string", description: "Current title (or part of it) of the todo to edit", optional: true },
    id: { type: "string", description: "Exact todo id, if known", optional: true },
    title: { type: "string", description: "New title", optional: true },
    priority: { type: "string", description: "New priority: low, medium, or high", optional: true },
    dueDate: { type: "string", description: "New due date in ISO format", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { todos, updateTodo } = useTodoStore.getState();
    const { item, error } = findByIdOrTitle(todos, { id: args.id as string, query: args.query as string }, "todo");
    if (error || !item) return this.failResponse(error || "Todo not found.");

    const changes: Record<string, unknown> = {};
    if (typeof args.title === "string") changes.title = args.title;
    if (typeof args.priority === "string") changes.priority = args.priority;
    if (typeof args.dueDate === "string") changes.dueDate = args.dueDate;
    if (Object.keys(changes).length === 0) return this.failResponse("No changes provided.");

    updateTodo(item.id, changes);
    return this.successResponse(`Updated todo "${(changes.title as string) || item.title}".`);
  }
}

class DeleteTodoTool extends BaseTool {
  name = "delete_todo";
  description = "Delete/remove a todo, identified by id or by its title (query).";
  parameters = {
    query: { type: "string", description: "Title (or part of it) of the todo to delete", optional: true },
    id: { type: "string", description: "Exact todo id, if known", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { todos, deleteTodo } = useTodoStore.getState();
    const { item, error } = findByIdOrTitle(todos, { id: args.id as string, query: args.query as string }, "todo");
    if (error || !item) return this.failResponse(error || "Todo not found.");
    deleteTodo(item.id);
    return this.successResponse(`Deleted todo "${item.title}".`);
  }
}

class ClearCompletedTodosTool extends BaseTool {
  name = "clear_completed_todos";
  description = "Remove all completed (done) todos at once.";
  parameters = {};

  async execute(_args: Record<string, unknown>): Promise<ToolResult> {
    const { todos, clearCompleted } = useTodoStore.getState();
    const count = todos.filter((t) => t.completed).length;
    if (count === 0) return this.successResponse("No completed todos to clear.");
    clearCompleted();
    return this.successResponse(`Cleared ${count} completed todo${count === 1 ? "" : "s"}.`);
  }
}

class AddNoteTool extends BaseTool {
  name = "add_note";
  description = "Create a note in the note-taking app. Use for anything the user wants to jot down, save, or remember as free text (ideas, lists, meeting notes, thoughts) — as opposed to a dated task (add_todo) or a scheduled event (add_event).";
  parameters = {
    title: { type: "string", description: "Short note title", optional: true },
    body: { type: "string", description: "The note content / body text", optional: true },
    tags: { type: "string", description: "Comma-separated tags, e.g. 'work,ideas'", optional: true },
    pinned: { type: "boolean", description: "Pin the note to the top", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { addNote } = useNotesStore.getState();
    const title = (args.title as string)?.trim() || "";
    const body = (args.body as string)?.trim() || "";
    if (!title && !body) return this.failResponse("A note needs a title or body.");
    const tags = typeof args.tags === "string"
      ? (args.tags as string).split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean)
      : [];
    const now = new Date().toISOString();
    addNote({
      id: uid("note"),
      title: title || "Untitled",
      body,
      tags,
      pinned: args.pinned === true || args.pinned === "true",
      attachments: [],
      createdAt: now,
      updatedAt: now,
    });
    return this.successResponse(`Added note: "${title || body.slice(0, 40)}"`);
  }
}

class ListNotesTool extends BaseTool {
  name = "list_notes";
  description = "List saved notes (output includes each note's id). Optionally filter by a search query matching title, body, or tags.";
  parameters = {
    query: { type: "string", description: "Optional text to filter notes by", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { notes } = useNotesStore.getState();
    const q = (args.query as string)?.trim().toLowerCase();
    const list = q
      ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some((t) => t.includes(q)))
      : notes;
    if (list.length === 0) return this.successResponse(q ? `No notes match "${args.query}".` : "No notes yet.");
    const lines = list.map((n) => {
      const preview = n.body.replace(/\s+/g, " ").slice(0, 60);
      const tags = n.tags.length ? ` #${n.tags.join(" #")}` : "";
      return `- [id:${n.id}]${n.pinned ? " 📌" : ""} ${n.title}${preview ? ` — ${preview}` : ""}${tags}`;
    });
    return this.successResponse(lines.join("\n"));
  }
}

class UpdateNoteTool extends BaseTool {
  name = "update_note";
  description = "Edit an existing note. Identify it by id or by its current title (query), then change title, body, tags, or pin.";
  parameters = {
    query: { type: "string", description: "Current title (or part of it) of the note to edit", optional: true },
    id: { type: "string", description: "Exact note id, if known", optional: true },
    title: { type: "string", description: "New title", optional: true },
    body: { type: "string", description: "New body text (replaces the existing body)", optional: true },
    tags: { type: "string", description: "New comma-separated tags (replaces existing tags)", optional: true },
    pinned: { type: "boolean", description: "Pin (true) or unpin (false) the note", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { notes, updateNote } = useNotesStore.getState();
    const { item, error } = findByIdOrTitle(notes, { id: args.id as string, query: args.query as string }, "note");
    if (error || !item) return this.failResponse(error || "Note not found.");

    const changes: Record<string, unknown> = {};
    if (typeof args.title === "string") changes.title = args.title;
    if (typeof args.body === "string") changes.body = args.body;
    if (typeof args.tags === "string") {
      changes.tags = (args.tags as string).split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean);
    }
    if (args.pinned === true || args.pinned === "true") changes.pinned = true;
    if (args.pinned === false || args.pinned === "false") changes.pinned = false;
    if (Object.keys(changes).length === 0) return this.failResponse("No changes provided.");

    updateNote(item.id, changes);
    return this.successResponse(`Updated note "${(changes.title as string) || item.title}".`);
  }
}

class DeleteNoteTool extends BaseTool {
  name = "delete_note";
  description = "Delete/remove a note, identified by id or by its title (query).";
  parameters = {
    query: { type: "string", description: "Title (or part of it) of the note to delete", optional: true },
    id: { type: "string", description: "Exact note id, if known", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const { notes, deleteNote } = useNotesStore.getState();
    const { item, error } = findByIdOrTitle(notes, { id: args.id as string, query: args.query as string }, "note");
    if (error || !item) return this.failResponse(error || "Note not found.");
    deleteNote(item.id);
    return this.successResponse(`Deleted note "${item.title}".`);
  }
}

class RememberEntityTool extends BaseTool {
  name = "remember_entity";
  description = "Store an entity in your knowledge graph. Use this when the user tells you something important about a person, place, concept, or thing that they might want you to recall later.";
  parameters = {
    name: { type: "string", description: "Entity name" },
    type: { type: "string", description: "Entity type (person, place, concept, project, preference, etc.)" },
    description: { type: "string", description: "What to remember about this entity" },
    tags: { type: "string", description: "Optional comma-separated tags", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const entity = addEntity(
      args.name as string,
      args.type as string,
      args.description as string,
      typeof args.tags === "string" ? (args.tags as string).split(",").map((t) => t.trim()) : undefined,
    );
    return this.successResponse(`Remembered "${entity.name}" as a ${entity.type}.`);
  }
}

class RememberRelationTool extends BaseTool {
  name = "remember_relation";
  description = "Create a relationship between two entities in your knowledge graph. Use this to connect things the user has told you about.";
  parameters = {
    from: { type: "string", description: "Entity id of the source" },
    to: { type: "string", description: "Entity id of the target" },
    type: { type: "string", description: "Relationship type (works_at, knows, likes, owns, etc.)" },
    description: { type: "string", description: "Describe the relationship" },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const result = addRelation(
      args.from as string,
      args.to as string,
      args.type as string,
      args.description as string,
    );
    if (typeof result === "string") return this.failResponse(result);
    return this.successResponse(`Linked "${result.from}" --[${result.type}]--> "${result.to}".`);
  }
}

class RecallMemoryTool extends BaseTool {
  name = "recall_memory";
  description = "Search your knowledge graph. Call this when the user asks about something they told you earlier, or when you need context from prior conversations.";
  parameters = {
    query: { type: "string", description: "What to search for in the knowledge graph" },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const result = queryGraph(args.query as string);
    return this.successResponse(result);
  }
}

class ListMemoryEntitiesTool extends BaseTool {
  name = "list_entities";
  description = "List all entities in your knowledge graph, optionally filtered by type. Each entity has an id you can use with remember_relation.";
  parameters = {
    type: { type: "string", description: "Optional type filter (person, place, concept, etc.)", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const result = listEntities(args.type as string | undefined);
    return this.successResponse(result);
  }
}

class GetRelatedTool extends BaseTool {
  name = "get_related";
  description = "Traverse the knowledge graph from an entity to find all connected entities up to a configurable depth.";
  parameters = {
    entityId: { type: "string", description: "Entity id to start from" },
    maxDepth: { type: "number", description: "Maximum traversal depth (1-5, default 2)", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const result = getRelated(args.entityId as string, (args.maxDepth as number) || 2);
    return this.successResponse(result);
  }
}

class FindPathTool extends BaseTool {
  name = "find_path";
  description = "Find the shortest path between two entities in the knowledge graph using BFS.";
  parameters = {
    fromId: { type: "string", description: "Starting entity id" },
    toId: { type: "string", description: "Target entity id" },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const result = findPath(args.fromId as string, args.toId as string);
    return this.successResponse(result);
  }
}

class UpdateMemoryEntityTool extends BaseTool {
  name = "update_entity";
  description = "Update an existing entity's name, description, type, tags, or importance.";
  parameters = {
    id: { type: "string", description: "Entity id to update" },
    name: { type: "string", description: "New name", optional: true },
    description: { type: "string", description: "New description", optional: true },
    type: { type: "string", description: "New type", optional: true },
    tags: { type: "string", description: "Comma-separated new tags", optional: true },
    importance: { type: "number", description: "Importance 0-10", optional: true },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const ok = updateEntity(args.id as string, {
      ...(args.name ? { name: args.name as string } : {}),
      ...(args.description ? { description: args.description as string } : {}),
      ...(args.type ? { type: args.type as string } : {}),
      ...(args.tags ? { tags: (args.tags as string).split(",").map((t) => t.trim()) } : {}),
      ...(args.importance ? { importance: args.importance as number } : {}),
    });
    return ok ? this.successResponse("Entity updated.") : this.failResponse("Entity not found.");
  }
}

class DeleteMemoryEntityTool extends BaseTool {
  name = "delete_entity";
  description = "Delete an entity and all its relations from the knowledge graph.";
  parameters = {
    id: { type: "string", description: "Entity id to delete" },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const ok = deleteEntity(args.id as string);
    return ok ? this.successResponse("Entity deleted.") : this.failResponse("Entity not found.");
  }
}

class DeleteRelationTool extends BaseTool {
  name = "delete_relation";
  description = "Delete a specific relation from the knowledge graph.";
  parameters = {
    id: { type: "string", description: "Relation id to delete" },
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const ok = deleteRelation(args.id as string);
    return ok ? this.successResponse("Relation deleted.") : this.failResponse("Relation not found.");
  }
}

export function createDefaultTools(): ToolCollection {
  return new ToolCollection(
    new AddEventTool(),
    new ListEventsTool(),
    new UpdateEventTool(),
    new DeleteEventTool(),
    new AddTodoTool(),
    new ListTodosTool(),
    new CompleteTodoTool(),
    new UpdateTodoTool(),
    new DeleteTodoTool(),
    new ClearCompletedTodosTool(),
    new AddNoteTool(),
    new ListNotesTool(),
    new UpdateNoteTool(),
    new DeleteNoteTool(),
    new GenerateInviteTool(),
    new GetSettingsTool(),
    new RememberEntityTool(),
    new RememberRelationTool(),
    new RecallMemoryTool(),
    new ListMemoryEntitiesTool(),
    new GetRelatedTool(),
    new FindPathTool(),
    new UpdateMemoryEntityTool(),
    new DeleteMemoryEntityTool(),
    new DeleteRelationTool(),
  );
}

export function createSystemPrompt(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const sessionLog = getSessionLog();
  const graphSummary = getGraphSummary();

  const memoryContext = [];
  if (sessionLog) memoryContext.push(`## Session History\n${sessionLog.slice(-3000)}`);
  if (graphSummary) memoryContext.push(graphSummary);

  const memoryBlock = memoryContext.length > 0 ? `\n${memoryContext.join("\n\n")}\n` : "";

  return `You are Seishin, a helpful AI assistant on the user's phone. You help with scheduling, todos, reminders, planning, advice, and general questions.${memoryBlock}

Current date and time: ${dateStr} at ${timeStr}

## PRIORITIES (in order)

1. SCHEDULE & TASK ACTIONS — HIGHEST PRIORITY.
   When the user wants to create, add, schedule, book, plan, or be reminded of anything task- or time-related, you MUST call the matching tool directly (do not write code, do not merely describe it), then briefly confirm what you did.
   - add_todo — tasks, todos, assignments, homework, reminders, deadlines.
   - add_event — calendar events, meetings, appointments, and time-blocked activities.
   - list_events — read saved calendar events (output includes each event's id).
   - list_todos — read saved tasks (output includes each todo's id; pass includeCompleted to also see finished ones).
   - update_event — edit an existing event (change its title, time, or description).
   - delete_event — remove/cancel an event.
   - complete_todo — mark a todo as done (or reopen it with done:false).
   - update_todo — edit a todo's title, priority, or due date.
   - delete_todo — remove a single todo.
   - clear_completed_todos — remove all finished todos at once.
   - add_note — save a free-text note (ideas, lists, meeting notes, thoughts).
   - list_notes — read saved notes (output includes each note's id; supports a search query).
   - update_note — edit a note's title, body, tags, or pin state.
   - delete_note — remove a note.
    - generate_invite — create an invite code.
    - get_settings — report the current setup.
    - remember_entity — store an important person, place, concept, or preference in your knowledge graph so you can recall it later.
    - remember_relation — connect two entities in your knowledge graph with a relationship.
    - recall_memory — search your knowledge graph for things the user told you in the past.
    - list_entities — list everything in your knowledge graph (optionally filter by type).
    - get_related — traverse the graph from an entity to find everything connected to it.
    - find_path — find the shortest path between two entities.
    - update_entity — update a stored entity's details.
    - delete_entity — remove an entity and its relations.
    - delete_relation — remove a specific relation.

   MEMORY: You have a knowledge graph that persists across sessions. When the user tells you something important about themselves (a preference, a fact about their life, a person they know, a project they're working on), call remember_entity to store it. When you need context from past conversations, call recall_memory. Check the Session History at the top of this prompt for what happened in the current session.

   EDITING / DELETING / COMPLETING: When the user wants to change, cancel, remove, delete, finish, or mark something done, call the matching tool above. Identify the item by its title using the "query" argument (a word or phrase from the item's name is enough) — you do NOT need the id. If unsure which item exists, call list_events, list_todos, or list_notes first. If a tool reports multiple matches, ask the user which one (or pass the id it listed).

   NOTES vs TODOS vs EVENTS: use add_note for free-form things to write down or remember (ideas, lists, journaling, meeting notes) with NO specific time; use add_todo for things to DO (optionally with a due date); use add_event for things happening at a set time. Events can also carry a "notes" field — set it via add_event/update_event when the user wants notes attached to a specific meeting/appointment.

2. MEMORY & KNOWLEDGE — second priority. When the user shares personal information, preferences, or facts about their life, call remember_entity to store it. Use recall_memory when you need to remember something from a prior session. Your knowledge graph is persistent and always available. Keep your notes up to date.

3. ANSWER & CONVERSE — for questions, explanations, advice, or plans the user only wants to read, respond naturally in plain language. No tool call.

4. CODE — only write code when the user explicitly asks for it. Never use code to add a todo or event; use the tools.

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
          id: uid("tool"),
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
          id: uid("tool-err"),
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

export async function runAgentLoop(
  userInput: string,
  opts?: { attachments?: AgentAttachment[]; extractedContext?: string },
) {
  const agentStore = useAgentStore.getState();
  const { apiKeys, nimEndpoint, nimModel } = useSettingsStore.getState();
  const { currentProvider } = agentStore;
  const attachments = opts?.attachments;
  const extractedContext = opts?.extractedContext?.trim();

  if (currentProvider === "local") {
    agentStore.addMessage({
      id: `msg-${Date.now()}`,
      role: "user",
      content: userInput,
      timestamp: new Date().toISOString(),
      attachments,
    });
    agentStore.setProcessing(false);
    const localResponse = "Local GGUF mode not yet available. Switch to NVIDIA NIM or configure a GGUF model.";
    agentStore.addMessage({
      id: `msg-${Date.now()}-local`,
      role: "assistant",
      content: localResponse,
      timestamp: new Date().toISOString(),
    });
    appendToSessionLog(userInput, localResponse);
    return;
  }

  const userMsg: AgentMessage = {
    id: `msg-${Date.now()}`,
    role: "user",
    content: userInput,
    timestamp: new Date().toISOString(),
    attachments,
  };
  agentStore.addMessage(userMsg);
  agentStore.setProcessing(true);
  currentAbort = new AbortController();
  // Safety timeout: never leave the UI stuck on "thinking" if the model or
  // network stalls. Aborts the request after 180s.
  const timeoutId = setTimeout(() => currentAbort?.abort(), 180000);

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

    // Attach extracted content (OCR text / readable file contents) to the
    // latest user turn so the model can act on it, WITHOUT polluting the
    // message the user sees in the chat (that stays as their typed text +
    // attachment previews).
    if (extractedContext) {
      for (let i = conversation.length - 1; i >= 0; i--) {
        if (conversation[i].role === "user") {
          const base = typeof conversation[i].content === "string" ? (conversation[i].content as string) : "";
          conversation[i] = {
            role: "user",
            content: `${base ? base + "\n\n" : ""}[Attached content]\n${extractedContext}`.trim(),
          };
          break;
        }
      }
    }

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

    // Append to session log so the AI can recall this exchange later.
    const finalMessages = useAgentStore.getState().messages;
    const lastAssistant = [...finalMessages].reverse().find((m) => m.role === "assistant");
    appendToSessionLog(userInput, lastAssistant?.content || "");

    // If app is in background, notify the user that the AI is done.
    if (AppState.currentState === "background" || AppState.currentState === "inactive") {
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Seishin",
          body: "Your AI assistant has finished.",
          data: { screen: "agent" },
        },
        trigger: null, // immediate
      }).catch(() => {});
    }
  }
}

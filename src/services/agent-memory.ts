import { agentStorage } from "@/stores/mmkv";
import { uid } from "@/utils/id";

const SESSION_KEY = "session_log";
const GRAPH_KEY = "knowledge_graph";

export interface GraphEntity {
  id: string;
  name: string;
  type: string;
  description: string;
  tags: string[];
  importance: number; // 0-10, higher = more important to keep
  createdAt: string;
  updatedAt: string;
}

export interface GraphRelation {
  id: string;
  from: string;
  to: string;
  type: string;
  description: string;
  createdAt: string;
}

interface GraphData {
  entities: GraphEntity[];
  relations: GraphRelation[];
}

function loadGraph(): GraphData {
  const raw = agentStorage.getString(GRAPH_KEY);
  return raw ? JSON.parse(raw) : { entities: [], relations: [] };
}

function saveGraph(graph: GraphData) {
  agentStorage.set(GRAPH_KEY, JSON.stringify(graph));
}

// ─── Entities ─────────────────────────────────────────────────

export function addEntity(
  name: string, type: string, description: string,
  tags?: string[], importance?: number,
): GraphEntity {
  const graph = loadGraph();
  // Dedup by normalized name + type
  const key = `${name.toLowerCase().trim()}:${type.toLowerCase()}`;
  const existing = graph.entities.find(
    (e) => `${e.name.toLowerCase().trim()}:${e.type.toLowerCase()}` === key,
  );
  if (existing) {
    existing.description = description;
    existing.tags = [...new Set([...existing.tags, ...(tags || [])])];
    existing.importance = Math.max(existing.importance, importance || 5);
    existing.updatedAt = new Date().toISOString();
    saveGraph(graph);
    return existing;
  }
  const entity: GraphEntity = {
    id: uid("ent"),
    name: name.trim(),
    type,
    description,
    tags: tags || [],
    importance: importance ?? 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  graph.entities.push(entity);
  saveGraph(graph);
  return entity;
}

export function updateEntity(
  id: string, updates: Partial<Pick<GraphEntity, "name" | "description" | "type" | "tags" | "importance">>,
): boolean {
  const graph = loadGraph();
  const idx = graph.entities.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  Object.assign(graph.entities[idx], updates, { updatedAt: new Date().toISOString() });
  saveGraph(graph);
  return true;
}

export function deleteEntity(id: string): boolean {
  const graph = loadGraph();
  const before = graph.entities.length;
  graph.entities = graph.entities.filter((e) => e.id !== id);
  graph.relations = graph.relations.filter((r) => r.from !== id && r.to !== id);
  if (graph.entities.length === before) return false;
  saveGraph(graph);
  return true;
}

// ─── Relations ─────────────────────────────────────────────────

export function addRelation(
  fromId: string, toId: string, type: string, description: string,
): GraphRelation | string {
  const graph = loadGraph();
  const from = graph.entities.find((e) => e.id === fromId);
  const to = graph.entities.find((e) => e.id === toId);
  if (!from) return `Entity with id "${fromId}" not found.`;
  if (!to) return `Entity with id "${toId}" not found.`;
  const relation: GraphRelation = {
    id: uid("rel"),
    from: fromId,
    to: toId,
    type,
    description,
    createdAt: new Date().toISOString(),
  };
  graph.relations.push(relation);
  saveGraph(graph);
  return relation;
}

export function deleteRelation(id: string): boolean {
  const graph = loadGraph();
  const before = graph.relations.length;
  graph.relations = graph.relations.filter((r) => r.id !== id);
  if (graph.relations.length === before) return false;
  saveGraph(graph);
  return true;
}

// ─── Graph Traversal ──────────────────────────────────────────

export function getRelated(entityId: string, maxDepth = 2): string {
  const graph = loadGraph();
  const start = graph.entities.find((e) => e.id === entityId);
  if (!start) return "Entity not found.";

  const visited = new Set<string>();
  const lines: string[] = [`## Connected to "${start.name}"`];

  function walk(id: string, depth: number) {
    if (depth > maxDepth || visited.has(id)) return;
    visited.add(id);
    const rels = graph.relations.filter((r) => r.from === id || r.to === id);
    for (const r of rels) {
      const otherId = r.from === id ? r.to : r.from;
      if (visited.has(otherId)) continue;
      const other = graph.entities.find((e) => e.id === otherId);
      if (!other) continue;
      const indent = "  ".repeat(depth);
      lines.push(`${indent}→ ${r.type}: **${other.name}** — ${r.description}`);
      walk(otherId, depth + 1);
    }
  }

  walk(entityId, 0);
  return lines.join("\n");
}

export function findPath(fromId: string, toId: string): string {
  const graph = loadGraph();
  const from = graph.entities.find((e) => e.id === fromId);
  const to = graph.entities.find((e) => e.id === toId);
  if (!from || !to) return "One or both entities not found.";

  // BFS
  const queue: { id: string; path: { id: string; via: string }[] }[] = [{ id: fromId, path: [] }];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const rels = graph.relations.filter((r) => r.from === current.id || r.to === current.id);
    for (const r of rels) {
      const next = r.from === current.id ? r.to : r.from;
      if (next === toId) {
        const fullPath = [...current.path, { id: r.id, via: r.type }];
        const lines = [`## Path from "${from.name}" to "${to.name}"`];
        let cursor = fromId;
        for (const step of fullPath) {
          const rel = graph.relations.find((r) => r.id === step.id)!;
          const other = graph.entities.find((e) => e.id === (rel.from === cursor ? rel.to : rel.from))!;
          lines.push(`→ ${rel.type}: **${other.name}**`);
          cursor = other.id;
        }
        return lines.join("\n");
      }
      if (!visited.has(next)) {
        visited.add(next);
        queue.push({ id: next, path: [...current.path, { id: r.id, via: r.type }] });
      }
    }
  }
  return `No path found between "${from.name}" and "${to.name}".`;
}

// ─── Query ────────────────────────────────────────────────────

export function queryGraph(search: string): string {
  const graph = loadGraph();
  const q = search.toLowerCase().trim();
  if (!q) return getGraphSummary();

  const matchedEntities = graph.entities.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q)),
  );

  const lines: string[] = [];
  if (matchedEntities.length > 0) {
    lines.push("## Knowledge Graph — Entities");
    for (const e of matchedEntities) {
      lines.push(`- **${e.name}** [id:${e.id}] (${e.type}): ${e.description}`);
      const rels = graph.relations.filter((r) => r.from === e.id || r.to === e.id);
      for (const r of rels) {
        const other = graph.entities.find((en) => en.id === (r.from === e.id ? r.to : r.from));
        if (other) lines.push(`  → ${r.type}: ${other.name} — ${r.description}`);
      }
    }
  }

  const matchedRelations = graph.relations.filter(
    (r) => r.type.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
  );
  if (matchedRelations.length > 0) {
    lines.push("\n## Relations");
    for (const r of matchedRelations) {
      const from = graph.entities.find((e) => e.id === r.from);
      const to = graph.entities.find((e) => e.id === r.to);
      lines.push(`- **${from?.name || "?"}** --[${r.type}]--> **${to?.name || "?"}**: ${r.description}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "Nothing found in your knowledge graph matching that query.";
}

export function getGraphSummary(): string {
  const graph = loadGraph();
  if (graph.entities.length === 0) return "";
  const lines = [`You have ${graph.entities.length} entities and ${graph.relations.length} relations in your knowledge graph.`];
  for (const e of graph.entities) {
    const relCount = graph.relations.filter((r) => r.from === e.id || r.to === e.id).length;
    lines.push(`- **${e.name}** [id:${e.id}] (${e.type}, ${relCount} connections)`);
  }
  return lines.join("\n");
}

export function listEntities(type?: string): string {
  const graph = loadGraph();
  const items = type ? graph.entities.filter((e) => e.type === type) : graph.entities;
  if (items.length === 0) return `No${type ? ` ${type}` : ""} entities found.`;
  return items
    .map((e) => `- **${e.name}** [id:${e.id}] (${e.type}): ${e.description}`)
    .join("\n");
}

// ─── Session Log ──────────────────────────────────────────────

export function getSessionLog(): string {
  return agentStorage.getString(SESSION_KEY) || "";
}

export function appendToSessionLog(userMessage: string, assistantResponse: string) {
  const existing = getSessionLog();
  const now = new Date().toLocaleString();
  const entry = `### ${now}\n**User**: ${userMessage}\n**Assistant**: ${assistantResponse || "(tool call)"}\n`;
  // Keep last ~20k chars to avoid bloat
  const updated = (existing + "\n" + entry).slice(-20000);
  agentStorage.set(SESSION_KEY, updated);
}

export function clearSessionLog() {
  agentStorage.set(SESSION_KEY, "");
}

export function clearKnowledgeGraph() {
  agentStorage.set(GRAPH_KEY, JSON.stringify({ entities: [], relations: [] }));
}

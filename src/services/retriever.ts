import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useNotesStore } from "@/stores/notes-store";
import { queryGraph, getGraphSummary } from "./agent-memory";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "it", "of", "to", "and", "or", "in",
  "on", "at", "for", "by", "with", "about", "from", "as", "are",
  "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may",
  "might", "shall", "can", "need", "dare", "ought", "used",
  "what", "which", "who", "whom", "when", "where", "why", "how",
  "all", "each", "every", "both", "few", "more", "most", "some",
  "any", "no", "not", "only", "own", "same", "so", "than", "too",
  "very", "just", "also", "now", "then", "here", "there", "up",
  "down", "this", "that", "these", "those", "i", "me", "my",
  "we", "our", "you", "your", "he", "she", "it", "they", "them",
  "tell", "let", "get", "got", "put", "set", "make", "take",
  "come", "go", "see", "know", "think", "like", "want", "give",
  "find", "tell", "ask", "try", "leave", "call", "please",
]);

function extractKeywords(query: string): string[] {
  return tokenize(query).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function score(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      score += kw.length;
      const regex = new RegExp(kw, "gi");
      const matches = lower.match(regex);
      if (matches) score += matches.length * 2;
    }
  }
  return score;
}

interface ScoredItem {
  text: string;
  score: number;
}

function rank(items: ScoredItem[], keywords: string[]): ScoredItem[] {
  return items
    .map((item) => ({ ...item, score: score(item.text, keywords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

export function retrieveRelevantContext(query: string): string {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return "";

  const items: ScoredItem[] = [];

  const { events } = useCalendarStore.getState();
  for (const e of events) {
    const text = `${e.title} ${e.description || ""} ${e.notes || ""} ${e.startDate}`;
    const date = new Date(e.startDate).toLocaleDateString();
    items.push({ text: `[Event] ${e.title} — ${date}${e.description ? `: ${e.description}` : ""}`, score: 0 });
  }

  const { todos } = useTodoStore.getState();
  for (const t of todos) {
    const date = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "";
    items.push({
      text: `[Todo] ${t.title} [${t.priority}]${date ? ` due ${date}` : ""}${t.completed ? " (done)" : ""}`,
      score: 0,
    });
  }

  const { notes } = useNotesStore.getState();
  for (const n of notes) {
    const preview = n.body.replace(/\s+/g, " ").slice(0, 150);
    items.push({
      text: `[Note] ${n.title}${preview ? ` — ${preview}` : ""}${n.tags.length ? ` #${n.tags.join(" #")}` : ""}`,
      score: 0,
    });
  }

  const ranked = rank(items, keywords);
  if (ranked.length === 0) return "";

  const lines = ["## Retrieved Context"];
  for (const item of ranked) {
    lines.push(`- ${item.text}`);
  }
  return lines.join("\n");
}

export function retrieveRelevantMemory(query: string): string {
  const result = queryGraph(query);
  if (result && !result.startsWith("Nothing found") && !result.startsWith("No")) {
    return `## Memory Results\n${result}`;
  }
  return "";
}

import { useCalendarStore, type CalendarEvent } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { uid } from "@/utils/id";
import { http } from "./http";
import { feedsState, type Feed } from "./state";
import { looksLikeDeadline, parseIcs, type FeedEvent } from "./ics";
import { planTaskSync, type ExternalTask } from "./task-sync-plan";

const PAST_MS = 30 * 86400000;
const MAX_BYTES = 5 * 1024 * 1024;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function normalizeFeedUrl(input: string): string | null {
  const u = input.trim().replace(/^webcals?:\/\//i, "https://");
  return /^https:\/\/[^\s]+$/i.test(u) ? u : null;
}

/** Split a parsed feed into calendar events and deadline tasks (pure — tested). */
export function planFeed(feed: Pick<Feed, "id" | "mode">, events: FeedEvent[], now = new Date()): { events: CalendarEvent[]; tasks: ExternalTask[] } {
  const out = { events: [] as CalendarEvent[], tasks: [] as ExternalTask[] };
  for (const e of events) {
    // Old one-off entries are noise; recurring series are kept (they continue).
    if (!e.recurrence && e.end.getTime() < now.getTime() - PAST_MS) continue;
    const key = hash(`${e.uid}|${e.start.toISOString()}`);
    if (feed.mode === "auto" && !e.recurrence && looksLikeDeadline(e)) {
      out.tasks.push({ externalId: key, title: e.title, due: e.start.toISOString(), done: false, url: e.url, notes: e.description });
      continue;
    }
    out.events.push({
      id: `feed-${feed.id}-${key}`,
      title: e.title,
      startDate: e.start.toISOString(),
      endDate: e.end.toISOString(),
      allDay: e.allDay || undefined,
      notes: [e.location ? `📍 ${e.location}` : "", e.description ?? ""].filter(Boolean).join("\n") || undefined,
      recurrence: e.recurrence,
      source: "feed",
      externalCalendarId: `feed:${feed.id}`,
    });
  }
  return out;
}

export async function fetchFeed(url: string): Promise<FeedEvent[]> {
  const text = await http<string>(url, { headers: { Accept: "text/calendar, text/plain, */*" }, timeoutMs: 20000 });
  if (typeof text !== "string" || !text.includes("BEGIN:VCALENDAR")) throw new Error("That link isn't a calendar feed (.ics)");
  if (text.length > MAX_BYTES) throw new Error("This calendar feed is too large");
  return parseIcs(text);
}

export function addFeed(name: string, url: string): Feed {
  const feed: Feed = { id: uid("feed"), name: name.trim() || "Calendar feed", url, mode: "auto", reminder: "persistent", enabled: true, lastSync: null, lastError: null };
  feedsState.set([...feedsState.get(), feed]);
  return feed;
}

/** Remove a feed and everything it brought in (its tasks are completed, not deleted). */
export function removeFeed(id: string) {
  feedsState.set(feedsState.get().filter((f) => f.id !== id));
  const cal = useCalendarStore.getState();
  cal.applyImport([], cal.events.filter((e) => e.externalCalendarId === `feed:${id}`).map((e) => e.id));
  const todos = useTodoStore.getState();
  todos.applySync([], [], todos.todos.filter((t) => t.external?.provider === `feed:${id}` && !t.completed).map((t) => t.id));
}

export async function syncFeed(feed: Feed): Promise<number> {
  try {
    const parsed = planFeed(feed, await fetchFeed(feed.url));
    const cal = useCalendarStore.getState();
    const incoming = new Set(parsed.events.map((e) => e.id));
    const removeIds = cal.events.filter((e) => e.externalCalendarId === `feed:${feed.id}` && !incoming.has(e.id)).map((e) => e.id);
    cal.applyImport(parsed.events, removeIds);
    const todos = useTodoStore.getState();
    const plan = planTaskSync(parsed.tasks, todos.todos, `feed:${feed.id}`, { reminder: feed.reminder, canCompleteRemote: false });
    todos.applySync(plan.create, plan.update, plan.completeLocal);
    feedsState.patch(feed.id, { lastSync: new Date().toISOString(), lastError: null });
    return parsed.events.length + plan.create.length;
  } catch (e) {
    feedsState.patch(feed.id, { lastError: e instanceof Error ? e.message : "Couldn't refresh" });
    return 0;
  }
}

export async function syncFeeds(): Promise<number> {
  let n = 0;
  for (const f of feedsState.get()) if (f.enabled) n += await syncFeed(f);
  return n;
}

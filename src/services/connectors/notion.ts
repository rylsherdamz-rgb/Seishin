import { useTodoStore } from "@/stores/todo-store";
import { http } from "./http";
import { getToken } from "./secrets";
import { notionState, type NotionState } from "./state";
import { normalizeDue, planTaskSync, type ExternalTask } from "./task-sync-plan";

const API = "https://api.notion.com/v1";
const VERSION = "2025-09-03";
const PROVIDER = "notion";

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Notion-Version": VERSION,
  "Content-Type": "application/json",
});

/** Accepts a database URL or a raw id; returns the 32-hex id (dashes optional). */
export function parseNotionId(input: string): string | null {
  const m = input.replace(/-/g, "").match(/([0-9a-f]{32})(?:[?#]|$)/i) ?? input.replace(/-/g, "").match(/([0-9a-f]{32})/i);
  return m ? m[1].toLowerCase() : null;
}

type Schema = Record<string, { type: string; status?: { groups?: { name: string; option_ids: string[] }[]; options?: { id: string; name: string }[] } }>;

/** Find the title / date / done properties automatically from the data source schema. */
export function detectProps(schema: Schema): Pick<NotionState, "titleProp" | "dateProp" | "doneProp" | "doneType" | "doneNames"> {
  const entries = Object.entries(schema);
  const title = entries.find(([, p]) => p.type === "title")?.[0] ?? null;
  const dateCandidates = entries.filter(([, p]) => p.type === "date");
  const date = (dateCandidates.find(([n]) => /due|deadline|date|when/i.test(n)) ?? dateCandidates[0])?.[0] ?? null;
  const status = entries.find(([, p]) => p.type === "status");
  if (status) {
    const cfg = status[1].status;
    const complete = cfg?.groups?.find((g) => /complete|done/i.test(g.name));
    const names = (cfg?.options ?? []).filter((o) => complete?.option_ids.includes(o.id)).map((o) => o.name);
    return { titleProp: title, dateProp: date, doneProp: status[0], doneType: "status", doneNames: names.length ? names : ["Done"] };
  }
  const check = entries.filter(([, p]) => p.type === "checkbox");
  const done = (check.find(([n]) => /done|complete|finished/i.test(n)) ?? check[0])?.[0] ?? null;
  return { titleProp: title, dateProp: date, doneProp: done, doneType: done ? "checkbox" : null, doneNames: [] };
}

/** Resolve a database to its (first) data source and detect its properties. */
export async function setupNotion(token: string, databaseInput: string): Promise<NotionState> {
  const id = parseNotionId(databaseInput);
  if (!id) throw new Error("That doesn't look like a Notion database link");
  const db = await http<{ data_sources?: { id: string; name: string }[]; title?: { plain_text: string }[] }>(`${API}/databases/${id}`, { headers: headers(token) });
  const ds = db.data_sources?.[0];
  if (!ds) throw new Error("This database has no data source the integration can read");
  const source = await http<{ properties: Schema }>(`${API}/data_sources/${ds.id}`, { headers: headers(token) });
  const props = detectProps(source.properties);
  if (!props.titleProp) throw new Error("Couldn't find a title column in that database");
  return notionState.set({ enabled: true, databaseId: id, dataSourceId: ds.id, ...props, lastError: null });
}

interface NotionPage {
  id: string;
  url: string;
  archived?: boolean;
  in_trash?: boolean;
  properties: Record<string, {
    type: string;
    title?: { plain_text: string }[];
    date?: { start: string; end?: string | null } | null;
    checkbox?: boolean;
    status?: { name: string } | null;
  }>;
}

function pageToTask(p: NotionPage, s: NotionState): ExternalTask {
  const title = (s.titleProp && p.properties[s.titleProp]?.title?.map((t) => t.plain_text).join("")) || "(Untitled)";
  const start = s.dateProp ? p.properties[s.dateProp]?.date?.start : undefined;
  const hasTime = !!start && start.includes("T");
  const doneProp = s.doneProp ? p.properties[s.doneProp] : undefined;
  const done = s.doneType === "checkbox" ? !!doneProp?.checkbox : s.doneType === "status" ? s.doneNames.includes(doneProp?.status?.name ?? "") : false;
  return { externalId: p.id, title, due: normalizeDue(hasTime ? undefined : start, hasTime ? start : undefined), done, url: p.url };
}

export async function syncNotion(): Promise<number> {
  const s = notionState.get();
  if (!s.enabled || !s.dataSourceId) return 0;
  const token = await getToken(PROVIDER);
  if (!token) { notionState.set({ lastError: "Reconnect Notion — token missing" }); return 0; }
  try {
    const pages: NotionPage[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 5; i++) {
      const res = await http<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>(`${API}/data_sources/${s.dataSourceId}/query`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      });
      pages.push(...res.results);
      if (!res.has_more || !res.next_cursor) break;
      cursor = res.next_cursor;
    }
    const remote = pages.filter((p) => !p.archived && !p.in_trash).map((p) => pageToTask(p, s));
    const store = useTodoStore.getState();
    const plan = planTaskSync(remote, store.todos, PROVIDER, { reminder: s.reminder, canCompleteRemote: !!s.doneProp });
    for (const pageId of plan.completeRemote) {
      const value = s.doneType === "checkbox" ? { checkbox: true } : { status: { name: s.doneNames[0] ?? "Done" } };
      await http(`${API}/pages/${pageId}`, { method: "PATCH", headers: headers(token), body: JSON.stringify({ properties: { [s.doneProp!]: value } }) }).catch(() => {});
    }
    store.applySync(plan.create, plan.update, plan.completeLocal);
    notionState.set({ lastSync: new Date().toISOString(), lastError: null });
    return plan.create.length + plan.update.length + plan.completeLocal.length;
  } catch (e) {
    notionState.set({ lastError: e instanceof Error ? e.message : "Sync failed" });
    return 0;
  }
}

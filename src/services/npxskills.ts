import { skillsStorage } from "@/stores/mmkv";

const REPO = "blunotech-dev/agents";
const API_BASE = `https://api.github.com/repos/${REPO}/contents`;

export interface NPXSkillMeta {
  id: string;
  name: string;
  category: string;
}

export interface NPXSkill extends NPXSkillMeta {
  description: string;
  content: string;
}

interface RawItem {
  name: string;
  type: string;
  path: string;
  download_url: string | null;
}

function cacheGet<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = skillsStorage.getString(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttlMs) return null;
    return data as T;
  } catch { return null; }
}

function cacheSet(key: string, data: unknown): void {
  skillsStorage.set(key, JSON.stringify({ data, ts: Date.now() }));
}

const CACHE_TTL = 10 * 60 * 1000; // 10 min

export async function fetchCategories(): Promise<string[]> {
  const cached = cacheGet<string[]>("npx-categories", CACHE_TTL);
  if (cached) return cached;

  const res = await fetch(API_BASE);
  if (!res.ok) {
    const stale = cacheGet<string[]>("npx-categories", Infinity);
    if (stale) return stale;
    throw new Error(`Rate limited by GitHub. Try again later.`);
  }
  const items: RawItem[] = await res.json();
  const cats = items.filter((i) => i.type === "dir").map((i) => i.name);
  cacheSet("npx-categories", cats);
  return cats;
}

export async function fetchSkillList(category: string): Promise<NPXSkillMeta[]> {
  const cacheKey = `npx-skill-list-${category}`;
  const cached = cacheGet<NPXSkillMeta[]>(cacheKey, CACHE_TTL);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/${encodeURIComponent(category)}`);
  if (!res.ok) {
    const stale = cacheGet<NPXSkillMeta[]>(cacheKey, Infinity);
    if (stale) return stale;
    throw new Error(`Failed to list skills in ${category}: HTTP ${res.status}`);
  }
  const items: RawItem[] = await res.json();
  const meta = items
    .filter((i) => i.type === "dir")
    .map((i) => ({
      id: i.name,
      name: i.name
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      category,
    }));
  cacheSet(cacheKey, meta);
  return meta;
}

export async function fetchSkillContent(skill: NPXSkillMeta): Promise<NPXSkill> {
  const url = `https://raw.githubusercontent.com/${REPO}/main/${encodeURIComponent(skill.category)}/${encodeURIComponent(skill.id)}/SKILL.md`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch skill content: HTTP ${res.status}`);
  const content = await res.text();
  const description = extractDescription(content);
  return { ...skill, description, content };
}

export async function fetchSkillBatch(
  category: string,
  offset: number,
  limit: number,
): Promise<{ skills: NPXSkill[]; total: number }> {
  const metaList = await fetchSkillList(category);
  const total = metaList.length;
  const batch = metaList.slice(offset, offset + limit);
  const skills = await Promise.all(
    batch.map((m) =>
      fetchSkillContent(m).catch(() => ({
        ...m,
        description: "",
        content: "",
      })),
    ),
  );
  return { skills: skills.filter((s) => !!s.content), total };
}

export async function fetchAllSkills(): Promise<NPXSkill[]> {
  const categories = await fetchCategories();
  const all: NPXSkill[] = [];
  for (const cat of categories) {
    const metaList = await fetchSkillList(cat);
    const skills = await Promise.all(
      metaList.map((m) =>
        fetchSkillContent(m).catch(() => null as unknown as NPXSkill),
      ),
    );
    all.push(...skills.filter(Boolean));
  }
  return all;
}

function extractDescription(content: string): string {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("```")) {
      return trimmed.slice(0, 200);
    }
  }
  return "";
}

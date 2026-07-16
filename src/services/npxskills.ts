const REPO = "blunotech-dev/agents";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main`;
const API_BASE = `https://api.github.com/repos/${REPO}/contents`;

export interface NPXSkill {
  id: string;
  name: string;
  category: string;
  description: string;
  content: string;
}

interface RawCategoryItem {
  name: string;
  type: string;
  path: string;
}

interface RawSkillItem {
  name: string;
  type: string;
  path: string;
  download_url: string | null;
}

export async function fetchCategories(): Promise<string[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(`Failed to fetch categories: HTTP ${res.status}`);
  const items: RawCategoryItem[] = await res.json();
  return items.filter((i) => i.type === "dir").map((i) => i.name);
}

export async function fetchSkillsByCategory(category: string): Promise<NPXSkill[]> {
  const encoded = encodeURIComponent(category);
  const res = await fetch(`${API_BASE}/${encoded}`);
  if (!res.ok) throw new Error(`Failed to fetch skills in ${category}: HTTP ${res.status}`);
  const items: RawSkillItem[] = await res.json();
  const dirs = items.filter((i) => i.type === "dir");
  const skills: NPXSkill[] = [];
  for (const dir of dirs) {
    try {
      const skillRes = await fetch(`${API_BASE}/${encodeURIComponent(dir.path)}`);
      if (!skillRes.ok) continue;
      const files: RawSkillItem[] = await skillRes.json();
      const skillMd = files.find((f) => f.name === "SKILL.md" || f.name === "skill.md");
      if (!skillMd || !skillMd.download_url) continue;
      const contentRes = await fetch(skillMd.download_url);
      if (!contentRes.ok) continue;
      const content = await contentRes.text();
      const name = dir.name
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      const description = extractDescription(content);
      skills.push({
        id: dir.name,
        name,
        category,
        description,
        content,
      });
    } catch {
      // skip individual skill failures
    }
  }
  return skills;
}

export async function fetchAllSkills(): Promise<NPXSkill[]> {
  const categories = await fetchCategories();
  const all: NPXSkill[] = [];
  for (const cat of categories) {
    const skills = await fetchSkillsByCategory(cat);
    all.push(...skills);
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

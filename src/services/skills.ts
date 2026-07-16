import { skillsStorage } from "@/stores/mmkv";

export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  enabled: boolean;
  builtIn: boolean;
}

const BUILT_IN_SKILLS: Skill[] = [
  {
    id: "skill-research",
    name: "Research & Analysis",
    description: "Deep reasoning, pros/cons, root cause analysis, and structured explanations",
    content: "You excel at structured reasoning. When asked analytical questions, break down your thinking step by step. Use frameworks like SWOT, first principles, or root cause analysis as appropriate. Present balanced pros/cons, compare alternatives, and cite reasoning chains.",
    enabled: false,
    builtIn: true,
  },
  {
    id: "skill-creative",
    name: "Creative Writing",
    description: "Storytelling, copywriting, marketing, and creative expression",
    content: "You have strong creative writing abilities. Adapt your tone and style to the task — professional for copywriting, vivid for storytelling, persuasive for marketing. Use literary devices naturally. Match the energy and voice the user sets.",
    enabled: false,
    builtIn: true,
  },
  {
    id: "skill-planner",
    name: "Planning & Strategy",
    description: "Project plans, timelines, roadmaps, and strategic thinking",
    content: "You are a strategic planner. Break down complex projects into phases, milestones, and actionable steps. Estimate timelines realistically. Identify dependencies, risks, and resource needs. Think in terms of quarters and OKRs when appropriate.",
    enabled: false,
    builtIn: true,
  },
  {
    id: "skill-coding",
    name: "Code & Technical",
    description: "Programming help, debugging, architecture, and code review",
    content: "You are an expert software engineer. Write clean, idiomatic code following best practices. When debugging, systematically isolate variables. Suggest test cases and edge cases. Consider performance, security, and maintainability.",
    enabled: false,
    builtIn: true,
  },
  {
    id: "skill-concise",
    name: "Ultra Concise",
    description: "One-sentence answers, minimal tokens, maximum efficiency",
    content: "You MUST answer in ONE sentence maximum. No pleasantries, no explanations, no bullet points. State the answer directly and stop. If a tool call is needed, call it without commentary. This overrides all other verbosity preferences.",
    enabled: false,
    builtIn: true,
  },
  {
    id: "skill-advice",
    name: "Life Coach & Advice",
    description: "Empathetic advice, coaching, mindset, and personal growth",
    content: "You are a thoughtful life coach. Listen actively, ask clarifying questions before giving advice. Offer multiple perspectives. Balance empathy with directness. Suggest actionable next steps. Draw from evidence-based approaches when relevant.",
    enabled: false,
    builtIn: true,
  },
  {
    id: "skill-nim-enhanced",
    name: "NIM Enhanced",
    description: "Only active with NVIDIA NIM — uses larger models for complex tasks",
    content: "NVIDIA NIM is available. For complex questions (research, analysis, code, planning), use the large model tier automatically. The large model has stronger reasoning and broader knowledge. Route tool-calling queries to the fast tier.",
    enabled: false,
    builtIn: true,
  },
];

function loadSkillsRaw(): Skill[] {
  const raw = skillsStorage.getString("skills");
  if (raw) {
    const saved = JSON.parse(raw) as Skill[];
    return mergeBuiltIn(saved);
  }
  return BUILT_IN_SKILLS.map((s) => ({ ...s }));
}

function mergeBuiltIn(saved: Skill[]): Skill[] {
  const savedMap = new Map(saved.map((s) => [s.id, s]));
  for (const bi of BUILT_IN_SKILLS) {
    if (savedMap.has(bi.id)) {
      const existing = savedMap.get(bi.id)!;
      savedMap.set(bi.id, { ...bi, enabled: existing.enabled, builtIn: true });
    } else {
      savedMap.set(bi.id, { ...bi });
    }
  }
  return Array.from(savedMap.values());
}

function persistSkills(skills: Skill[]): void {
  skillsStorage.set("skills", JSON.stringify(skills));
}

export function getSkills(): Skill[] {
  return loadSkillsRaw();
}

export function toggleSkill(id: string): Skill[] {
  const skills = loadSkillsRaw();
  const skill = skills.find((s) => s.id === id);
  if (!skill) return skills;
  skill.enabled = !skill.enabled;
  persistSkills(skills);
  return skills;
}

export function setSkillEnabled(id: string, enabled: boolean): Skill[] {
  const skills = loadSkillsRaw();
  const skill = skills.find((s) => s.id === id);
  if (!skill) return skills;
  skill.enabled = enabled;
  persistSkills(skills);
  return skills;
}

export function addCustomSkill(skill: Omit<Skill, "builtIn">): Skill[] {
  const skills = loadSkillsRaw();
  skills.push({ ...skill, builtIn: false });
  persistSkills(skills);
  return skills;
}

export function removeCustomSkill(id: string): Skill[] {
  const skills = loadSkillsRaw().filter((s) => s.builtIn || s.id !== id);
  persistSkills(skills);
  return skills;
}

export function updateCustomSkill(id: string, updates: Partial<Skill>): Skill[] {
  const skills = loadSkillsRaw();
  const skill = skills.find((s) => s.id === id && !s.builtIn);
  if (!skill) return skills;
  Object.assign(skill, updates);
  persistSkills(skills);
  return skills;
}

export function getEnabledSkillsContent(): string {
  const skills = loadSkillsRaw().filter((s) => s.enabled);
  if (skills.length === 0) return "";
  return skills
    .map((s) => `[Skill: ${s.name}]\n${s.content}`)
    .join("\n\n");
}

export function getEnabledSkillNames(): string[] {
  return loadSkillsRaw().filter((s) => s.enabled).map((s) => s.name);
}

import planJson from "../../data/mandalart.json";

/** Le plan Mandalart tel qu'écrit avec JP (docs/MANDALART_VALKYRIA.md → data/mandalart.json).
 *  Ne jamais modifier le contenu du plan sans JP : on régénère le JSON à partir du .md
 *  (`node scripts/mandalart-build.mjs`). Ce fichier est lu côté serveur seulement (160 ko). */

export type Priority = "star" | "progressive";
export type TaskStatus = "a_faire" | "en_cours" | "fait" | "abandonne";

export interface PlanTask {
  code: string;
  priority: Priority;
  level: number;
  title: string;
  due: string | null;
  owner: string | null;
  links: string[];
  initialStatus: TaskStatus;
  addedOn?: string;
  theme?: string | null;
}

export interface PlanObjective {
  code: string;
  name: string;
  description: string;
  kpis: string[];
  tasks: PlanTask[];
}

export interface PlanPillar {
  code: string;
  name: string;
  intro: string;
  focus: string | null;
  objectives: PlanObjective[];
  shortObjectives: string[];
}

export interface PlanKpi {
  id: string;
  label: string;
  start: string;
  target: string;
  due: string | null;
  source: string;
  how: string;
  addedOn?: string;
}

export interface PlanLevel {
  id: number;
  code: string;
  name: string;
  start: string;
  end: string;
  goal: string;
  plannedTasks: number;
  plannedStars: number;
}

export interface PlanMonth {
  month: string;
  kind: string;
  target: number;
  floor: number;
  cumulTarget: number;
  how: string;
}

export interface PlanAgent {
  id: string;
  order: number;
  name: string;
  level: number;
  prerequisites: string[];
  tasks: string[];
  objective: string | null;
  role: string;
  triggers: string[];
  reads: string[];
  does: string[];
  humanValidation: string;
  access: string;
  metrics: string;
}

export interface PlanAutomation {
  id: string;
  name: string;
  type: string;
  trigger: string;
  does: string;
  forWho: string;
  state: string;
  level: number;
  tasks: string[];
  note: string | null;
  addedOn?: string;
}

export interface MandalartPlan {
  version: string | null;
  center: { statement: string; goalCents: number; milestoneCents: number; year: number; jpYearlyCents: number; notes: { indent: boolean; text: string }[] };
  progressRules: string[];
  kpis: PlanKpi[];
  levels: PlanLevel[];
  trajectory: {
    intro: string[];
    salary: string[];
    years: { year: string; target: number; floor: number; lines: Record<string, number | null> }[];
    periods: { period: string; target: number; floor: number; half: boolean }[];
    months: PlanMonth[];
  };
  pillars: PlanPillar[];
  agentsIntro: string[];
  agentRules: string[];
  agentModes: { name: string; text: string }[];
  agents: PlanAgent[];
  automations: PlanAutomation[];
  additions: { title: string | null; rules: string[]; themes: { title: string; text: string }[] };
  decisions: string[];
}

export const PLAN = planJson as unknown as MandalartPlan;

export const PILLAR_SLUGS = PLAN.pillars.map((p) => p.code.toLowerCase());

export function pillarBySlug(slug: string): PlanPillar | null {
  return PLAN.pillars.find((p) => p.code.toLowerCase() === slug.toLowerCase()) ?? null;
}

export function linkLabel(id: string): string {
  const a = PLAN.agents.find((x) => x.id === id);
  if (a) return `${a.id} ${a.name}`;
  const au = PLAN.automations.find((x) => x.id === id);
  return au ? `${au.id} ${au.name}` : id;
}

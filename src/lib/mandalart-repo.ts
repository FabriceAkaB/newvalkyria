import { CLUB_ID } from "@/lib/club";
import {
  buildLiveTasks,
  executionOf,
  levelProgress,
  pillarProgress,
  type CustomTask,
  type LiveTask,
  type TaskState
} from "@/lib/mandalart-core";
import { computeKpis, computeRealFigures, type KpiView, type RealFigures } from "@/lib/mandalart-kpis";
import { PLAN, type TaskStatus } from "@/lib/mandalart-plan";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Lecture et écriture de l'état du Mandalart (cases cochées, journal, indicateurs manuels,
 *  état des agents). Le plan lui-même vient de data/mandalart.json. */

function db() {
  return getSupabaseAdminClient() as any;
}

export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

export async function getTaskStates(): Promise<TaskState[]> {
  const { data, error } = await db().from("mandalart_tasks_state").select("code, status, note, evidence_url, done_at, updated_at, due, planned_due, fixed").eq("club_id", CLUB_ID);
  if (error) throw error;
  return data ?? [];
}

export async function getCustomTasks(): Promise<CustomTask[]> {
  const { data, error } = await db().from("mandalart_tasks_custom").select("code, objective, title, level, priority, due, owner").eq("club_id", CLUB_ID).order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function getLiveTasks(today = todayIso()): Promise<LiveTask[]> {
  const [states, customs] = await Promise.all([getTaskStates(), getCustomTasks()]);
  return buildLiveTasks(PLAN, states, customs, today);
}

/** Change le statut d'une tâche et l'écrit au journal. La note et la preuve sont gardées si non fournies. */
export async function setTaskStatus(input: { code: string; status: TaskStatus; note?: string | null; evidenceUrl?: string | null; by: string }): Promise<void> {
  const tasks = await getLiveTasks();
  const task = tasks.find((t) => t.code === input.code);
  if (!task) throw new Error("Tâche introuvable");
  const row: Record<string, unknown> = {
    club_id: CLUB_ID,
    code: input.code,
    status: input.status,
    done_at: input.status === "fait" ? (task.status === "fait" ? task.doneAt : new Date().toISOString()) : null,
    updated_at: new Date().toISOString(),
    updated_by: input.by
  };
  if (input.note !== undefined) row.note = input.note;
  if (input.evidenceUrl !== undefined) row.evidence_url = input.evidenceUrl;
  const { error } = await db().from("mandalart_tasks_state").upsert(row, { onConflict: "club_id,code" });
  if (error) throw error;
  if (task.status !== input.status || input.note) {
    await db().from("mandalart_events").insert({ club_id: CLUB_ID, code: input.code, from_status: task.status, to_status: input.status, note: input.note ?? null, by: input.by });
  }
}

/** Date fixe d'une tâche : elle n'est jamais reportée automatiquement. */
export async function setTaskFixed(code: string, fixed: boolean, by: string): Promise<void> {
  const task = (await getLiveTasks()).find((t) => t.code === code);
  if (!task) throw new Error("Tâche introuvable");
  const { error } = await db()
    .from("mandalart_tasks_state")
    .upsert({ club_id: CLUB_ID, code, status: task.status, fixed, updated_at: new Date().toISOString(), updated_by: by }, { onConflict: "club_id,code" });
  if (error) throw error;
  await db().from("mandalart_events").insert({ club_id: CLUB_ID, code, from_status: task.status, to_status: task.status, note: fixed ? "Date fixe : ne sera jamais reportée" : "Date fixe retirée", by });
}

/** Report automatique du matin (rescheduleTasks) : écrit la nouvelle date, garde la date d'origine, note chaque report au journal. */
export async function applyReschedule(today = todayIso()): Promise<{ code: string; from: string; to: string; reason: "retard" | "suite"; title: string }[]> {
  const { rescheduleTasks } = await import("@/lib/mandalart-reschedule");
  const tasks = await getLiveTasks(today);
  const { data: states } = await db().from("mandalart_tasks_state").select("code, planned_due, postponed_count").eq("club_id", CLUB_ID);
  const stateOf = new Map(((states ?? []) as any[]).map((s) => [s.code, s]));
  const changes = rescheduleTasks(tasks.map((t) => ({ code: t.code, objective: t.objective, due: t.due, status: t.status, fixed: t.fixed })), today);
  const now = new Date().toISOString();
  for (const c of changes) {
    const t = tasks.find((x) => x.code === c.code)!;
    const prev = stateOf.get(c.code);
    const { error } = await db()
      .from("mandalart_tasks_state")
      .upsert(
        { club_id: CLUB_ID, code: c.code, status: t.status, due: c.to, planned_due: prev?.planned_due ?? c.from, postponed_count: (prev?.postponed_count ?? 0) + 1, updated_at: now, updated_by: "Report automatique" },
        { onConflict: "club_id,code" }
      );
    if (error) throw error;
  }
  if (changes.length) {
    const fr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });
    await db()
      .from("mandalart_events")
      .insert(
        changes.map((c) => {
          const t = tasks.find((x) => x.code === c.code)!;
          return { club_id: CLUB_ID, code: c.code, from_status: t.status, to_status: t.status, note: c.reason === "retard" ? `Pas faite : reportée du ${fr(c.from)} au ${fr(c.to)}` : `Réorganisée du ${fr(c.from)} au ${fr(c.to)} (suit une tâche reportée)`, by: "Report automatique" };
        })
      );
  }
  return changes.map((c) => ({ ...c, title: tasks.find((x) => x.code === c.code)?.title ?? c.code }));
}

export async function addCustomTask(input: { objective: string; title: string; level: number; priority: "star" | "progressive"; due: string | null; owner: string | null; by: string }): Promise<string> {
  const objective = PLAN.pillars.flatMap((p) => p.objectives).find((o) => o.code === input.objective);
  if (!objective) throw new Error("Objectif introuvable");
  const customs = (await getCustomTasks()).filter((c) => c.objective === input.objective);
  const code = `${input.objective}.X${String(customs.length + 1).padStart(2, "0")}`;
  const { error } = await db()
    .from("mandalart_tasks_custom")
    .insert({ club_id: CLUB_ID, code, objective: input.objective, title: input.title, level: input.level, priority: input.priority, due: input.due, owner: input.owner });
  if (error) throw error;
  await db().from("mandalart_events").insert({ club_id: CLUB_ID, code, from_status: null, to_status: "a_faire", note: `Tâche ajoutée : ${input.title}`, by: input.by });
  return code;
}

export interface MandalartEvent {
  id: number;
  code: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  note: string | null;
  at: string;
  by: string | null;
}

export async function getEvents(limit = 100): Promise<MandalartEvent[]> {
  const { data, error } = await db().from("mandalart_events").select("*").eq("club_id", CLUB_ID).order("at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface KpiValueRow {
  id: number;
  kpi_id: string;
  value: number;
  measured_at: string;
  source: "auto" | "manuel";
  note: string | null;
}

export async function getKpiValues(): Promise<KpiValueRow[]> {
  const { data, error } = await db().from("mandalart_kpi_values").select("id, kpi_id, value, measured_at, source, note").eq("club_id", CLUB_ID).order("measured_at", { ascending: true }).order("id");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ ...r, value: Number(r.value) }));
}

export async function addKpiValue(input: { kpiId: string; value: number; measuredAt?: string; note?: string | null; source?: "auto" | "manuel" }): Promise<void> {
  if (!PLAN.kpis.some((k) => k.id === input.kpiId)) throw new Error("Indicateur inconnu");
  const { error } = await db()
    .from("mandalart_kpi_values")
    .insert({ club_id: CLUB_ID, kpi_id: input.kpiId, value: input.value, measured_at: input.measuredAt ?? todayIso(), source: input.source ?? "manuel", note: input.note ?? null });
  if (error) throw error;
}

export interface AgentStateRow {
  item_id: string;
  status: "a_creer" | "en_construction" | "actif" | "pause";
  mode: "assistant" | "semi-automatique" | "autonome" | null;
  hours_saved_week: number | null;
  note: string | null;
  updated_at: string;
}

export async function getAgentStates(): Promise<AgentStateRow[]> {
  const { data, error } = await db().from("mandalart_agent_state").select("item_id, status, mode, hours_saved_week, note, updated_at").eq("club_id", CLUB_ID);
  if (error) throw error;
  return data ?? [];
}

export async function setAgentState(input: { itemId: string; status: AgentStateRow["status"]; mode?: AgentStateRow["mode"]; hoursSavedWeek?: number | null; note?: string | null }): Promise<void> {
  const known = PLAN.agents.some((a) => a.id === input.itemId) || PLAN.automations.some((a) => a.id === input.itemId);
  if (!known) throw new Error("Agent ou automatisation inconnu");
  const row: Record<string, unknown> = { club_id: CLUB_ID, item_id: input.itemId, status: input.status, updated_at: new Date().toISOString() };
  if (input.mode !== undefined) row.mode = input.mode;
  if (input.hoursSavedWeek !== undefined) row.hours_saved_week = input.hoursSavedWeek;
  if (input.note !== undefined) row.note = input.note;
  const { error } = await db().from("mandalart_agent_state").upsert(row, { onConflict: "club_id,item_id" });
  if (error) throw error;
}

/** État initial d'une automatisation : « partiel » dans le plan = en construction. */
export function initialAutomationStatus(state: string): AgentStateRow["status"] {
  if (/actif|existe/i.test(state)) return "actif";
  if (/partiel|construction/i.test(state)) return "en_construction";
  return "a_creer";
}

export interface MandalartOverview {
  today: string;
  tasks: LiveTask[];
  pillars: ReturnType<typeof pillarProgress>;
  execution: number;
  levels: ReturnType<typeof levelProgress>["levels"];
  currentLevel: number;
  kpis: KpiView[];
  figures: RealFigures;
  results: { caYearCents: number; goalCents: number; milestoneCents: number; progress: number; year: number; ca12mCents: number };
}

/** Tout ce dont les écrans ont besoin, en un seul passage. */
export async function getMandalartOverview(): Promise<MandalartOverview> {
  const today = todayIso();
  const [tasks, figures] = await Promise.all([getLiveTasks(today), computeRealFigures(today)]);
  const kpis = await computeKpis(figures);
  const kpiMet = (id: string) => kpis.find((k) => k.id === id)?.met ?? false;
  const pillars = pillarProgress(PLAN, tasks, kpiMet);
  const { levels, current } = levelProgress(PLAN, tasks, today);
  const caYear = kpis.find((k) => k.id === "ca_annee")?.current ?? 0;
  const ca12 = kpis.find((k) => k.id === "ca_12m")?.current ?? 0;
  return {
    today,
    tasks,
    pillars,
    execution: executionOf(pillars),
    levels,
    currentLevel: current,
    kpis,
    figures,
    results: {
      caYearCents: Math.round(caYear * 100),
      goalCents: PLAN.center.goalCents,
      milestoneCents: PLAN.center.milestoneCents,
      progress: Math.min(1, (caYear * 100) / PLAN.center.goalCents),
      year: Number(today.slice(0, 4)),
      ca12mCents: Math.round(ca12 * 100)
    }
  };
}

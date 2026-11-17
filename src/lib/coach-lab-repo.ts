import { CLUB_ID } from "@/lib/club";
import { average, labStatus, type LabStatus } from "@/lib/coach-lab-core";
import { getPrinciples, saveMethodDoc } from "@/lib/coaching-method-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Laboratoire des éducateurs (tables `coach_experiments`, `coach_experiment_trials`). Règles : coach-lab-core.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface LabTrial {
  id: string;
  activityId: string | null;
  activityLabel: string | null;
  date: string | null;
  coachName: string;
  rating: number | null;
  observation: string | null;
}

export interface LabExperiment {
  id: string;
  title: string;
  source: string | null;
  hypothesis: string | null;
  howTo: string | null;
  status: LabStatus;
  createdBy: string;
  createdAt: string;
  trials: LabTrial[];
  average: number | null;
}

const clean = (v: unknown, max = 2000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const coachName = (c: any) => `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Éducateur";

export async function listExperiments(): Promise<LabExperiment[]> {
  const [{ data: exps, error }, { data: trials }] = await Promise.all([
    db().from("coach_experiments").select("*, coach:coaches(first_name, last_name)").eq("club_id", CLUB_ID).order("created_at", { ascending: false }),
    db().from("coach_experiment_trials").select("*, coach:coaches(first_name, last_name), activity:coach_activities(activity_date, start_time, title)").order("created_at")
  ]);
  if (error) throw new Error(error.message);
  return ((exps ?? []) as any[]).map((e) => {
    const mine: LabTrial[] = ((trials ?? []) as any[])
      .filter((t) => t.experiment_id === e.id)
      .map((t) => ({
        id: t.id,
        activityId: t.activity_id,
        activityLabel: t.activity ? `${t.activity.title ?? "Pratique"} · ${String(t.activity.start_time ?? "").slice(0, 5).replace(":", " h ")}` : null,
        date: t.activity?.activity_date ? String(t.activity.activity_date).slice(0, 10) : String(t.created_at).slice(0, 10),
        coachName: coachName(t.coach),
        rating: t.rating,
        observation: t.observation
      }));
    const ratings = mine.map((t) => t.rating).filter((r): r is number => typeof r === "number");
    return {
      id: e.id,
      title: e.title,
      source: e.source,
      hypothesis: e.hypothesis,
      howTo: e.how_to,
      status: e.status as LabStatus,
      createdBy: coachName(e.coach),
      createdAt: String(e.created_at).slice(0, 10),
      trials: mine,
      average: average(ratings)
    };
  });
}

export async function createExperiment(coachId: string | null, input: Record<string, unknown>): Promise<string> {
  const title = clean(input.title, 200);
  if (!title) throw new Error("Donne un nom au concept à tester.");
  const { data, error } = await db()
    .from("coach_experiments")
    .insert({ club_id: CLUB_ID, title, source: clean(input.source, 500), hypothesis: clean(input.hypothesis), how_to: clean(input.howTo), created_by: coachId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Un essai à une pratique ; le statut de l'expérience se recalcule (sauf une décision de JP). */
export async function addTrial(experimentId: string, input: { activityId: string | null; coachId: string | null; rating: number | null; observation: unknown }): Promise<void> {
  const { error } = await db()
    .from("coach_experiment_trials")
    .insert({ experiment_id: experimentId, activity_id: input.activityId, coach_id: input.coachId, rating: input.rating, observation: clean(input.observation) });
  if (error) throw new Error(error.message);
  await refreshStatus(experimentId);
}

async function refreshStatus(experimentId: string) {
  const [{ data: e }, { data: trials }] = await Promise.all([
    db().from("coach_experiments").select("status").eq("id", experimentId).single(),
    db().from("coach_experiment_trials").select("rating").eq("experiment_id", experimentId)
  ]);
  const next = labStatus(e.status, ((trials ?? []) as any[]).map((t) => t.rating).filter((r): r is number => typeof r === "number"));
  if (next !== e.status) await db().from("coach_experiments").update({ status: next, updated_at: new Date().toISOString() }).eq("id", experimentId);
}

/** Décision de JP : abandonner, remettre à l'essai, ou faire entrer dans la méthode (ajouté aux principes Valkyria). */
export async function decideExperiment(experimentId: string, action: "methode" | "abandonner" | "reprendre"): Promise<void> {
  const { data: e, error } = await db().from("coach_experiments").select("*").eq("id", experimentId).single();
  if (error || !e) throw new Error("Expérience introuvable");
  const now = new Date().toISOString();
  if (action === "methode") {
    const principles = await getPrinciples();
    const text = [e.hypothesis, e.how_to ? `Comment : ${e.how_to}` : null, e.source ? `Source : ${e.source}` : null, "Validé au laboratoire des éducateurs."].filter(Boolean).join(" ");
    if (!principles.items.some((p) => p.title === e.title)) await saveMethodDoc("principes", { items: [...principles.items, { title: e.title, text }] });
    await db().from("coach_experiments").update({ status: "dans_methode", decided_at: now, updated_at: now }).eq("id", experimentId);
    return;
  }
  await db().from("coach_experiments").update({ status: action === "abandonner" ? "abandonne" : "en_test", decided_at: action === "abandonner" ? now : null, updated_at: now }).eq("id", experimentId);
  if (action === "reprendre") await refreshStatus(experimentId);
}

/** Les pratiques où un essai peut se noter : celles de l'Académie des 3 dernières semaines et des 2 prochaines. */
export async function practicesForTrial(): Promise<{ id: string; label: string; date: string }[]> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const add = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const { data } = await db()
    .from("coach_activities")
    .select("id, activity_date, start_time, title, activity_type")
    .is("organization", null)
    .in("activity_type", ["Pratique", "Camp"])
    .gte("activity_date", add(today, -21))
    .lte("activity_date", add(today, 14))
    .order("activity_date", { ascending: false });
  return ((data ?? []) as any[]).map((a) => ({ id: a.id, date: String(a.activity_date).slice(0, 10), label: `${String(a.activity_date).slice(0, 10)} · ${String(a.start_time).slice(0, 5).replace(":", " h ")} · ${a.title ?? "Pratique"}` }));
}

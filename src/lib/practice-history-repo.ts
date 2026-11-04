import { type PracticeRecord } from "@/lib/practice-history";
import { groupName, together } from "@/lib/practice-survey-repo";
import { createActivityFor, listPractices, SEASON, todayIso, type Practice } from "@/lib/practices-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Historique exact de chaque pratique de l'Académie depuis le début de la saison : déposée ou non, présences,
 *  sondage, analyse. Les groupes au même gymnase à la même heure forment une seule pratique (comme le sondage). */

function db() {
  return getSupabaseAdminClient() as any;
}

const HERE = ["present", "late", "left_early"];

export interface HistoryRow extends PracticeRecord {
  key: string;
  start: string;
  location: string;
  group: string;
  activityId: string | null;
  deckUrl: string | null;
  analysisText: string | null;
}

export async function getPracticeHistory(): Promise<HistoryRow[]> {
  const today = todayIso();
  const practices = (await listPractices({ from: SEASON.start, to: today })).filter((p) => !p.organization && p.activityType !== "Match");
  const ids = practices.map((p) => p.activityId).filter((x): x is string => Boolean(x));
  const [{ data: acts }, { data: att }] = ids.length
    ? await Promise.all([
        db().from("coach_activities").select("id, deck_url, analysis").in("id", ids),
        db().from("activity_player_attendance").select("activity_id, status, practice_rating, fatigue").in("activity_id", ids)
      ])
    : [{ data: [] }, { data: [] }];
  const act = new Map(((acts ?? []) as any[]).map((a) => [a.id, a]));
  const rows = (att ?? []) as any[];

  const used = new Set<string>();
  const out: HistoryRow[] = [];
  for (const p of practices) {
    if (used.has(p.key)) continue;
    const mates = practices.filter((q) => !used.has(q.key) && together(p, q));
    mates.forEach((q) => used.add(q.key));
    const withAct = mates.filter((q) => q.activityId);
    const main: Practice = [...mates].sort((a, b) => Number(Boolean(b.activityId)) - Number(Boolean(a.activityId)) || b.blocks - a.blocks)[0];
    const here = rows.filter((r) => withAct.some((q) => q.activityId === r.activity_id) && HERE.includes(r.status));
    const deck = withAct.map((q) => act.get(q.activityId!)?.deck_url).find(Boolean) ?? null;
    const analysis = withAct.map((q) => act.get(q.activityId!)?.analysis).find(Boolean) ?? null;
    out.push({
      key: main.key,
      date: main.date,
      start: main.start,
      location: main.location,
      group: `${mates.map((q) => groupName(q.group)).join(" et ")}`,
      activityId: main.activityId,
      planned: mates.some((q) => q.blocks > 0),
      deck: Boolean(deck),
      deckUrl: deck,
      present: here.length,
      answered: here.filter((r) => r.practice_rating != null && r.fatigue != null).length,
      analysis: Boolean(analysis),
      analysisText: analysis
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
}

/** Dépose une pratique passée : le lien de ses diapos et/ou son analyse. Crée l'activité de l'horaire au besoin. */
export async function depositPractice(input: { key: string; deckUrl?: string | null; analysis?: string | null }): Promise<string | null> {
  const today = todayIso();
  const practice = (await listPractices({ from: SEASON.start, to: today })).find((p) => p.key === input.key);
  if (!practice) return null;
  const id = practice.activityId ?? (await createActivityFor({ date: practice.date, start: practice.start, end: practice.end, location: practice.location, group: practice.group }));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.deckUrl !== undefined) patch.deck_url = input.deckUrl;
  if (input.analysis !== undefined) {
    patch.analysis = input.analysis;
    patch.analysis_at = input.analysis ? new Date().toISOString() : null;
  }
  const { error } = await db().from("coach_activities").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return id;
}

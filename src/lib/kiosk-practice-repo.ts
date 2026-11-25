import { cleanCategory, getActivityRoster } from "@/lib/coach-portal-repo";
import { getActivity } from "@/lib/coaches-repo";
import { getExercisesForPlanning } from "@/lib/exercises-repo";
import { planBlocks, type PlanBlockView } from "@/lib/practice-plan-view";
import { academyPractices, groupName, together } from "@/lib/practice-survey-repo";
import { todayIso, type Practice } from "@/lib/practices-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getThemeForDate } from "@/lib/season-themes-repo";
import { getBlocksForActivity } from "@/lib/session-plan-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { themeForGroup } from "@/lib/theme-quiz-core";

/** La borne du bord du terrain (code 180180, JP 18 nov. 2026) : la pratique du jour et le sondage des filles,
 *  ouverts une fois avec du réseau puis lisibles sans réseau. */

function db() {
  return getSupabaseAdminClient() as any;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export interface KioskPractice {
  key: string;
  date: string;
  start: string;
  end: string | null;
  location: string;
  label: string;
  activityId: string | null;
  /** Le plan est prêt (blocs ou diapos). */
  ready: boolean;
}

/** Les pratiques de l'Académie d'aujourd'hui (sinon celles du prochain jour de pratique, dans les 3 jours),
 *  les groupes au même endroit à la même heure réunis en une seule. */
export async function getKioskPractices(): Promise<KioskPractice[]> {
  const today = todayIso();
  const all = await academyPractices(today, addDays(today, 3));
  const day = all.some((p) => p.date === today) ? today : all.map((p) => p.date).sort()[0];
  const sameDay = all.filter((p) => p.date === day).sort((a, b) => a.start.localeCompare(b.start));
  const used = new Set<string>();
  const out: KioskPractice[] = [];
  for (const p of sameDay) {
    if (used.has(p.key)) continue;
    const mates = sameDay.filter((q) => !used.has(q.key) && together(p, q));
    mates.forEach((q) => used.add(q.key));
    const main = mates.find((q) => q.activityId && (q.blocks > 0 || q.deposited > 0)) ?? mates.find((q) => q.activityId) ?? p;
    out.push({
      key: main.key,
      date: p.date,
      start: p.start,
      end: p.end,
      location: p.location,
      label: `Filles ${[...new Set(mates.map((q) => groupName(q.group)))].join(" et ")}`,
      activityId: main.activityId,
      ready: mates.some((q) => q.blocks > 0 || q.deposited > 0)
    });
  }
  return out;
}

export interface KioskPlan {
  theme: { theme: string; notes: string | null } | null;
  blocks: PlanBlockView[];
  /** Diapos déposées, avec un lien signé de 6 heures : la page les télécharge tout de suite pour les garder hors réseau. */
  decks: { id: string; fileName: string; url: string }[];
  players: number;
}

/** Le plan d'une pratique : ses blocs (ou ceux d'un groupe à la même heure au même endroit) et ses diapos. */
export async function getKioskPlan(activityId: string): Promise<KioskPlan | null> {
  const activity = await getActivity(activityId);
  if (!activity) return null;
  const date = String(activity.activity_date).slice(0, 10);
  const sameDay: Practice[] = await academyPractices(date, date).catch(() => []);
  const me = sameDay.find((p) => p.activityId === activityId);
  const ids = [activityId, ...(me ? sameDay.filter((q) => q.activityId && q.activityId !== activityId && together(me, q)).map((q) => q.activityId!) : [])];

  let blocks = await getBlocksForActivity(activityId);
  for (const id of ids.slice(1)) {
    if (blocks.length) break;
    blocks = await getBlocksForActivity(id);
  }
  const [exercises, theme, roster, { data: docs }] = await Promise.all([
    blocks.length ? getExercisesForPlanning(date, blocks.map((b) => b.exercise_id)) : Promise.resolve([]),
    getThemeForDate(SEASON_DB_ID, new Date(`${date}T12:00:00`)).catch(() => null),
    getActivityRoster(activity).catch(() => []),
    db().from("documents").select("id, file_name, storage_path, uploaded_at").eq("entity_type", "coach_activity").eq("category", "Pratique").in("entity_id", ids).order("uploaded_at")
  ]);
  const decks: KioskPlan["decks"] = [];
  for (const d of (docs ?? []) as any[]) {
    const { data } = await db().storage.from("documents").createSignedUrl(d.storage_path, 6 * 3600);
    if (data?.signedUrl) decks.push({ id: d.id, fileName: String(d.file_name), url: data.signedUrl });
  }
  const players = Math.max(roster.length, 1);
  return {
    // Le thème de la catégorie (« 2016-2017 » prend celui de 2016) : le même que la question du sondage.
    theme: theme ? { theme: themeForGroup(theme, cleanCategory(activity.category)) ?? theme.theme, notes: theme.notes ?? null } : null,
    blocks: planBlocks(blocks, exercises as unknown as Record<string, unknown>[], String(activity.start_time), players),
    decks,
    players: roster.length
  };
}

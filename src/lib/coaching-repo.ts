import { holdDetail, getPayrollRows, missingBeforePayroll } from "@/lib/coach-payroll-data";
import { getFeedbackWeeks } from "@/lib/coach-portal-repo";
import { PARTICIPATED, QUICK_CRITERIA, watchReasons, type FeedbackWeek } from "@/lib/coach-report";
import { getBank } from "@/lib/exercises-repo";
import { listPractices, type Practice } from "@/lib/practices-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Espace coaching de l'admin : seulement le foot (pratiques, exercices, progression des joueuses, rapports des
 *  éducateurs). Aucun montant ici : la paie et l'argent restent dans l'espace Académie. */

function db() {
  return getSupabaseAdminClient() as any;
}

const TZ = "America/Toronto";
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const fullName = (r: { player_first_name?: string | null; player_last_name?: string | null }) =>
  `${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.replace(/\s+/g, " ").trim();
const avg = (vals: number[]) => (vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null);

/* ── Progression des joueuses ────────────────────────────────────── */

export interface PlayerProgress {
  registrationId: string;
  name: string;
  group: string;
  photoUrl: string | null;
  evaluations: number;
  averages: Record<string, number | null>;
  /** Variation des 3 dernières évaluations par rapport aux 3 premières (null s'il y en a moins de 4). */
  trend: number | null;
  practiceRating: number | null;
  fatigue: number | null;
  attended: number;
  marked: number;
  watch: string[];
}

export async function getPlayersProgress(): Promise<PlayerProgress[]> {
  const { data: season } = await db().from("seasons").select("id").eq("is_active", true).maybeSingle();
  const seasonId = season?.id ?? "automne-hiver-2026";
  const [{ data: regs }, { data: slots }, { data: evals }, { data: att }] = await Promise.all([
    db().from("registrations").select("id, player_first_name, player_last_name, category_id, time_slot_template_id, players(photo_url)").eq("season_id", seasonId).eq("status", "paid").eq("is_trial", false),
    db().from("time_slot_templates").select("id, day, start_time"),
    db().from("player_evaluations").select("registration_id, ratings, activity:coach_activities(activity_date)"),
    db().from("activity_player_attendance").select("registration_id, status, practice_rating, fatigue, activity:coach_activities(activity_date)")
  ]);
  const byReg = <T extends { registration_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.registration_id, [...(m.get(r.registration_id) ?? []), r]);
    return m;
  };
  const date = (r: any) => String(r.activity?.activity_date ?? "").slice(0, 10);
  const evalsBy = byReg((evals ?? []) as any[]);
  const attBy = byReg((att ?? []) as any[]);

  return ((regs ?? []) as any[])
    .map((r) => {
      const ev = (evalsBy.get(r.id) ?? []).sort((a: any, b: any) => date(a).localeCompare(date(b)));
      const at = (attBy.get(r.id) ?? []).sort((a: any, b: any) => date(a).localeCompare(date(b)));
      const slot = ((slots ?? []) as any[]).find((s) => s.id === r.time_slot_template_id);
      const averages: Record<string, number | null> = {};
      for (const c of QUICK_CRITERIA) averages[c] = avg(ev.map((e: any) => Number(e.ratings?.[c])).filter((v: number) => v >= 1 && v <= 5));
      const overall = ev.map((e: any) => avg(QUICK_CRITERIA.map((c) => Number(e.ratings?.[c])).filter((v) => v >= 1 && v <= 5))).filter((v: number | null): v is number => v !== null);
      const fb = at.filter((a: any) => a.practice_rating != null || a.fatigue != null);
      return {
        registrationId: r.id,
        name: fullName(r),
        group: slot ? `${slot.day} ${String(slot.start_time).slice(0, 5)} · ${r.category_id ?? ""}` : `Filles ${r.category_id ?? ""}`,
        photoUrl: r.players?.photo_url ?? null,
        evaluations: ev.length,
        averages,
        trend: overall.length >= 4 ? Math.round(((avg(overall.slice(-3)) ?? 0) - (avg(overall.slice(0, 3)) ?? 0)) * 10) / 10 : null,
        practiceRating: avg(fb.map((a: any) => a.practice_rating).filter((v: any) => v != null)),
        fatigue: avg(fb.map((a: any) => a.fatigue).filter((v: any) => v != null)),
        attended: at.filter((a: any) => PARTICIPATED.includes(a.status)).length,
        marked: at.length,
        watch: watchReasons({
          evaluations: ev.map((e: any) => ({ date: date(e), ratings: e.ratings })),
          feedback: fb.map((a: any) => ({ date: date(a), practice_rating: a.practice_rating, fatigue: a.fatigue }))
        })
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group, "fr") || a.name.localeCompare(b.name, "fr"));
}

/* ── Cette semaine sur le terrain ─────────────────────────────────── */

export interface CoachingWeek {
  practices: Practice[];
  theme: string | null;
  feedback: FeedbackWeek | null;
  reportsMissing: { coach: string; date: string; start: string; label: string; detail: string; activityId: string }[];
  bank: { approuve: number; aValider: number; aTester: number; aChanger: number; total: number };
  toWatch: PlayerProgress[];
}

export async function getCoachingWeek(): Promise<CoachingWeek> {
  const today = todayIso();
  const [practices, weeks, rows, bank, players] = await Promise.all([
    listPractices({ from: today, to: addDays(today, 7) }).catch(() => []),
    getFeedbackWeeks().catch(() => []),
    getPayrollRows().catch(() => []),
    getBank().catch(() => ({ entries: [], ratings: [] })),
    getPlayersProgress().catch(() => [])
  ]);
  const count = (s: string) => bank.entries.filter((e) => e.bank.status === s).length;
  return {
    practices,
    theme: practices.find((p) => p.theme)?.theme ?? null,
    feedback: weeks[0] ?? null,
    // Sans montant : l'espace coaching ne parle que du rapport manquant, pas de la paie retenue.
    reportsMissing: missingBeforePayroll(rows).map((r) => ({
      coach: r.coachName,
      date: String(r.activityDate).slice(0, 10),
      start: r.activityStart,
      label: r.activityLabel,
      detail: holdDetail(r),
      activityId: r.activityId
    })),
    bank: { approuve: count("approuve"), aValider: count("a-valider"), aTester: count("a-tester"), aChanger: count("a-changer"), total: bank.entries.filter((e) => e.bank.status !== "retire").length },
    toWatch: players.filter((p) => p.watch.length > 0)
  };
}

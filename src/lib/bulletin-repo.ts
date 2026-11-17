import { currentPeriod, periodRange, seasonDates, summarize, type BulletinPeriod, type BulletinSummary, type PeriodRange } from "@/lib/bulletin-report";
import { getPlayerAttendanceHistory, getPlayerEvaluations, getPlayerObjectives } from "@/lib/coach-portal-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Les données d'un bulletin de progression (mi-saison ou fin de saison) pour une inscription. Règles : bulletin-report.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface BulletinReportData {
  registrationId: string;
  player: { firstName: string; lastName: string; dob: string | null; category: string | null; group: string | null; advanced: boolean; photoUrl: string | null };
  seasonLabel: string;
  range: PeriodRange;
  summary: BulletinSummary;
  objectives: string[];
  /** Notes écrites des éducateurs : seulement pour l'équipe (jamais pour les parents). */
  notes: { date: string; coach: string; text: string }[];
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

export async function getBulletinReport(registrationId: string, opts: { period?: BulletinPeriod | null; audience: "equipe" | "parent" }): Promise<BulletinReportData | null> {
  const { data: reg } = await db()
    .from("registrations")
    .select("id, season_id, player_first_name, player_last_name, player_dob, category_id, advanced_group, player_id, time_slot_template_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return null;
  const [attendance, evaluations, objectives, { data: slot }, { data: player }, { data: caps }] = await Promise.all([
    getPlayerAttendanceHistory(registrationId),
    getPlayerEvaluations(registrationId),
    getPlayerObjectives(registrationId),
    reg.time_slot_template_id ? db().from("time_slot_templates").select("day, start_time").eq("id", reg.time_slot_template_id).maybeSingle() : Promise.resolve({ data: null }),
    reg.player_id ? db().from("players").select("photo_url").eq("id", reg.player_id).maybeSingle() : Promise.resolve({ data: null }),
    db().from("practice_teams").select("leadership, activity:coach_activities(activity_date)").eq("captain_registration_id", registrationId)
  ]);
  const period = opts.period ?? currentPeriod(reg.season_id, today());
  const range = periodRange(reg.season_id, period, today());
  const dates = seasonDates(reg.season_id);
  const day = (v: unknown) => String(v ?? "").slice(0, 10);
  const summary = summarize({
    evaluations: evaluations.map((e: any) => ({ date: day(e.activity?.activity_date), coachId: e.coach_id ?? null, ratings: e.ratings ?? {} })),
    attendance: attendance.map((a: any) => ({ date: day(a.activity?.activity_date), status: a.status, practice_rating: a.practice_rating, fatigue: a.fatigue, learning: a.learning, understanding: a.understanding, confidence: a.confidence })),
    captaincies: ((caps ?? []) as any[]).map((c) => ({ date: day(c.activity?.activity_date), leadership: c.leadership })),
    from: range.from,
    to: range.to,
    mid: period === "fin-saison" ? dates.mid : null
  });
  const inRange = (d: string) => d >= range.from && d <= range.to;
  return {
    registrationId,
    player: {
      firstName: String(reg.player_first_name ?? "").trim(),
      lastName: String(reg.player_last_name ?? "").trim(),
      dob: reg.player_dob ? day(reg.player_dob) : null,
      category: reg.category_id ?? null,
      group: slot ? `${slot.day} ${String(slot.start_time).slice(0, 5).replace(":", " h ")}` : null,
      advanced: Boolean(reg.advanced_group),
      photoUrl: player?.photo_url ?? null
    },
    seasonLabel: dates.label,
    range,
    summary,
    objectives: objectives.filter((o) => o.active).map((o) => o.objective),
    notes:
      opts.audience === "parent"
        ? []
        : evaluations
            .filter((e: any) => e.comment && inRange(day(e.activity?.activity_date)))
            .map((e: any) => ({ date: day(e.activity?.activity_date), coach: `${e.coach?.first_name ?? ""} ${e.coach?.last_name ?? ""}`.trim(), text: e.comment }))
  };
}

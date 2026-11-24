import { CLUB_ID } from "@/lib/club";
import { getActivityReports, TEAM_ACCESS_DAYS } from "@/lib/coach-portal-repo";
import { isBoysActivity, reportMissing, REPORT_REQUIRED_TYPES } from "@/lib/coach-report";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Les pratiques de JP à regarder, évaluer et rapporter depuis l'admin (JP, 25 nov. 2026) :
 *  celles d'aujourd'hui, et celles des jours d'avant (dans la fenêtre d'accès du portail) dont le rapport n'est pas fini.
 *  Le bouton passe par le pont `api/admin/coach-portal`, qui ouvre le portail sous le profil d'éducateur de JP. */

const db = () => getSupabaseAdminClient() as any;
const TZ = "America/Toronto";
const isoDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const shiftDay = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Le profil d'éducateur de JP (app_settings « coach_admin_id »), ou null s'il n'est pas réglé. */
export async function getAdminCoachId(): Promise<string | null> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", "coach_admin_id").maybeSingle();
  const v = typeof data?.value === "string" ? data.value.replace(/"/g, "") : null;
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/** Lien du pont admin → portail des éducateurs, ouvert sur la vue « tout-en-un » de la pratique. */
export const allInOneHref = (activityId: string) => `/api/admin/coach-portal?activite=${activityId}&vue=tout-en-un`;

export interface MyPractice {
  activityId: string;
  date: string;
  start: string;
  end: string;
  label: string;
  location: string | null;
  isToday: boolean;
  expected: number;
  present: number;
  evaluated: number;
  /** Ce qui manque au rapport, en mots simples (vide = rapport fini). */
  missing: string[];
  href: string;
}

export async function getMyPracticesToReport(now: Date = new Date()): Promise<MyPractice[]> {
  const coachId = await getAdminCoachId();
  if (!coachId) return [];
  const today = isoDay(now);
  const from = shiftDay(today, -TEAM_ACCESS_DAYS.before);
  const { data, error } = await db()
    .from("coach_activities")
    .select("id, activity_date, start_time, end_time, title, category, location, activity_type, organization")
    .gte("activity_date", from)
    .lte("activity_date", today)
    .is("organization", null)
    .in("activity_type", REPORT_REQUIRED_TYPES)
    .order("activity_date", { ascending: false })
    .order("start_time");
  if (error) throw new Error(error.message);
  // Programmes de garçons : pas de rapport sur les joueuses.
  const activities = ((data ?? []) as any[]).filter((a) => !isBoysActivity(a));
  const reports = await getActivityReports(activities);
  const out: MyPractice[] = [];
  for (const a of activities) {
    const date = String(a.activity_date).slice(0, 10);
    const report = reports.get(a.id);
    if (!report?.required) continue;
    const missing = reportMissing(report, coachId);
    const isToday = date === today;
    if (!isToday && missing.length === 0) continue;
    out.push({
      activityId: a.id,
      date,
      start: String(a.start_time).slice(0, 5),
      end: String(a.end_time).slice(0, 5),
      label: a.title || a.category || a.activity_type,
      location: a.location ? String(a.location).split(/\s[–-]\s/)[0] : null,
      isToday,
      expected: report.expected,
      present: report.participated,
      evaluated: report.participated - report.evaluationsMissing.length,
      missing,
      href: allInOneHref(a.id)
    });
  }
  // Aujourd'hui d'abord (par heure), puis les jours d'avant du plus récent au plus ancien.
  return out.sort((x, y) => Number(y.isToday) - Number(x.isToday) || (x.isToday ? x.start.localeCompare(y.start) : y.date.localeCompare(x.date) || x.start.localeCompare(y.start)));
}

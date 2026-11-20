import { dailyReportHours, hasReportHour, REPORT_RULE_V2_START, reportHour } from "@/lib/coach-report";
import { getActivityReports, type ReportActivity } from "@/lib/coach-portal-repo";
import { getResendClient } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Courriel automatique à l'éducateur (JP, 20 nov. 2026) : quand tous ses rapports d'une même journée sont finis,
 *  il reçoit un avis que son heure de rapport est ajoutée à sa banque d'heures. Un seul par éducateur et par jour
 *  (table coach_report_notices). Même règle que la paie : `reportHour` + `dailyReportHours`. */

function db() {
  return getSupabaseAdminClient() as any;
}

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** Texte du courriel (pur, testé). */
export function reportDoneEmail(firstName: string, day: string): { subject: string; html: string; text: string } {
  const when = dayLabel(day);
  const subject = `Vos rapports du ${when} sont complets`;
  const lines = [
    `Bonjour ${firstName},`,
    `Ceci est un courriel automatique pour vous aviser que vous avez bien rempli tous vos rapports du ${when}.`,
    "Votre heure de rapport a été ajoutée à votre banque d'heures.",
    "Merci beaucoup !",
    "L'équipe New Valkyria"
  ];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px">${lines.map((l) => `<p>${l}</p>`).join("")}</div>`;
  return { subject, html, text: lines.join("\n\n") };
}

/** L'heure de rapport de ce coach pour ce jour : due (il y a droit) et gagnée (tous les rapports du jour finis). */
export async function reportDayStatus(coachId: string, day: string): Promise<{ due: boolean; earned: boolean }> {
  const { data } = await db()
    .from("coach_assignments")
    .select("id, status, paid, activity:coach_activities!inner(id, activity_date, start_time, category, activity_type, organization, title)")
    .eq("coach_id", coachId)
    .eq("activity.activity_date", day);
  const rows = ((data ?? []) as any[]).filter((r) => r.activity);
  if (!rows.length) return { due: false, earned: false };
  const { data: coach } = await db().from("coaches").select("role").eq("id", coachId).maybeSingle();
  const reports = await getActivityReports(rows.map((r) => r.activity as ReportActivity));
  const daily = dailyReportHours(
    rows.map((r) => ({
      key: r.id,
      coachId,
      date: day,
      start: String(r.activity.start_time).slice(0, 5),
      ...reportHour({ activityDate: day, status: r.status, role: coach?.role, coachId, report: reports.get(r.activity.id) ?? null })
    }))
  );
  const due = [...daily.values()].find((d) => d.due);
  return due ?? { due: false, earned: false };
}

/** Envoie l'avis si ce jour-là est gagné et pas encore annoncé. Retourne ce qui s'est passé. */
export async function notifyReportDayIfDone(coachId: string, day: string): Promise<"sent" | "already" | "pending" | "skip"> {
  if (day < REPORT_RULE_V2_START) return "skip";
  const { data: coach } = await db().from("coaches").select("id, first_name, email, role, status").eq("id", coachId).maybeSingle();
  if (!coach?.email || !hasReportHour(coach.role)) return "skip";
  // JP remplit son rapport depuis l'admin : pas de courriel à lui-même.
  const { data: admin } = await db().from("app_settings").select("value").eq("key", "coach_admin_id").maybeSingle();
  if (admin?.value && String(admin.value).replace(/"/g, "") === coachId) return "skip";
  const { data: sent } = await db().from("coach_report_notices").select("coach_id").eq("coach_id", coachId).eq("day", day).maybeSingle();
  if (sent) return "already";
  const status = await reportDayStatus(coachId, day);
  if (!status.due || !status.earned) return "pending";
  // La ligne d'abord (deux enregistrements en même temps n'envoient qu'un courriel), effacée si l'envoi échoue.
  const { error } = await db().from("coach_report_notices").insert({ coach_id: coachId, day });
  if (error) return "already";
  const mail = reportDoneEmail(String(coach.first_name ?? "").trim() || "coach", day);
  const res = await getResendClient().emails.send({ to: coach.email, ...mail } as never).catch((e: Error) => ({ error: { message: e.message } }));
  if ((res as { error?: { message: string } | null }).error) {
    await db().from("coach_report_notices").delete().eq("coach_id", coachId).eq("day", day);
    return "pending";
  }
  return "sent";
}

/** Après un enregistrement sur une pratique (évaluation, retour, présences, sondage) : vérifie chaque coach assigné. */
export async function notifyActivityCoaches(activityId: string): Promise<void> {
  const { data: activity } = await db().from("coach_activities").select("activity_date").eq("id", activityId).maybeSingle();
  if (!activity) return;
  const day = String(activity.activity_date).slice(0, 10);
  const { data } = await db().from("coach_assignments").select("coach_id, status").eq("activity_id", activityId);
  for (const a of (data ?? []) as any[]) if (a.status === "present") await notifyReportDayIfDone(a.coach_id, day).catch(() => null);
}

/** Passage de secours (cron horaire) : aujourd'hui et les 2 jours d'avant, pour chaque coach qui y a travaillé. */
export async function sweepReportNotices(today: string): Promise<number> {
  const days = [0, 1, 2].map((n) => new Date(Date.parse(`${today}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10)).filter((d) => d >= REPORT_RULE_V2_START);
  if (!days.length) return 0;
  const { data } = await db().from("coach_assignments").select("coach_id, status, activity:coach_activities!inner(activity_date)").in("activity.activity_date", days).eq("status", "present");
  const pairs = new Set(((data ?? []) as any[]).map((r) => `${r.coach_id}|${String(r.activity.activity_date).slice(0, 10)}`));
  let sent = 0;
  for (const p of pairs) {
    const [coachId, day] = p.split("|");
    if ((await notifyReportDayIfDone(coachId, day).catch(() => "pending")) === "sent") sent++;
  }
  return sent;
}

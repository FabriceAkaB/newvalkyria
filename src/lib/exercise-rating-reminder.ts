import { activityEndMs } from "@/lib/coach-report";
import { env } from "@/lib/env";
import { getResendClient } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Une heure après la fin d'une pratique (JP, 19 nov. 2026) : chaque éducateur assigné qui n'a pas encore noté les
 *  exercices de la banque utilisés reçoit un courriel avec le lien de la pratique. Une seule fois par pratique.
 *  Lancé toutes les heures (cron mcs-robot) : on prend les pratiques finies il y a 1 à 3 heures. */
export async function remindExerciseRatings(now = Date.now()): Promise<{ sent: number }> {
  const db = getSupabaseAdminClient() as any;
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const { data: acts } = await db.from("coach_activities").select("id, activity_date, end_time, title, category, activity_type, organization").eq("activity_date", today).in("activity_type", ["Pratique", "Camp"]).is("organization", null);
  const ended = ((acts ?? []) as any[]).filter((a) => {
    const end = activityEndMs(today, String(a.end_time).slice(0, 5));
    return now - end >= 60 * 60_000 && now - end <= 3 * 60 * 60_000 && !/gar[cç]on/i.test(`${a.title ?? ""} ${a.category ?? ""}`);
  });
  if (!ended.length) return { sent: 0 };
  const ids = ended.map((a) => a.id);
  const [{ data: blocks }, { data: ratings }, { data: asg }] = await Promise.all([
    db.from("activity_session_blocks").select("activity_id, exercise_id").in("activity_id", ids).not("exercise_id", "is", null),
    db.from("exercise_ratings").select("activity_id, coach_id, exercise_id").in("activity_id", ids),
    db.from("coach_assignments").select("id, activity_id, coach_id, status, rating_reminder_sent_at, coach:coaches(first_name, email, status)").in("activity_id", ids).is("rating_reminder_sent_at", null)
  ]);
  let sent = 0;
  for (const a of (asg ?? []) as any[]) {
    if (a.status === "absent" || a.status === "cancelled" || a.coach?.status !== "active" || !a.coach?.email) continue;
    const exercises = [...new Set(((blocks ?? []) as any[]).filter((b) => b.activity_id === a.activity_id).map((b) => b.exercise_id))];
    if (!exercises.length) continue;
    const done = new Set(((ratings ?? []) as any[]).filter((r) => r.activity_id === a.activity_id && r.coach_id === a.coach_id).map((r) => r.exercise_id));
    const left = exercises.filter((e) => !done.has(e)).length;
    if (!left) continue;
    const act = ended.find((x) => x.id === a.activity_id);
    const url = `${env.publicSiteUrl}/entraineur/activites/${a.activity_id}`;
    const first = String(a.coach.first_name ?? "").trim();
    const label = act?.title || act?.category || "ta pratique";
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px"><p>Bonjour${first ? ` ${first}` : ""},</p><p>Merci pour la pratique (${label}). Il te reste ${left} exercice${left > 1 ? "s" : ""} à noter sur 10 : surtout, à quel point chacun a fait ressortir le thème de la semaine. 30 secondes par exercice, pendant que c'est frais.</p><p><a href="${url}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">Noter les exercices</a></p><p>L'équipe New Valkyria</p></div>`;
    const text = `Bonjour${first ? ` ${first}` : ""},\n\nMerci pour la pratique (${label}). Il te reste ${left} exercice${left > 1 ? "s" : ""} à noter sur 10 : surtout, à quel point chacun a fait ressortir le thème de la semaine.\n\nNoter les exercices : ${url}\n\nL'équipe New Valkyria`;
    const res = await getResendClient().emails.send({ to: a.coach.email, subject: "Note les exercices de ta pratique (2 minutes)", html, text } as never);
    if ((res as { error?: unknown }).error) continue;
    await db.from("coach_assignments").update({ rating_reminder_sent_at: new Date().toISOString() }).eq("id", a.id);
    sent++;
  }
  return { sent };
}

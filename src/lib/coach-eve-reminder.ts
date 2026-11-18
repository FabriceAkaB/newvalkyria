import { cleanCategory } from "@/lib/coach-portal-repo";
import { env } from "@/lib/env";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getThemeForDate, themeFor } from "@/lib/season-themes-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Rappel de la veille aux éducateurs (JP, 17 nov. 2026 ; plan des deux espaces, phase 3) : la veille de chaque
 *  pratique de l'Académie, chaque éducateur assigné reçoit « voici ce que tu dois avoir repéré avant la pratique » :
 *  l'heure, le lieu, le thème, les exercices dans l'ordre, et le lien du guide à cocher et des diapos.
 *  Un seul courriel par assignation (coach_assignments.eve_reminder_sent_at). Lancé par le cron « pratiques » (16 h). */

function db() {
  return getSupabaseAdminClient() as any;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hhmm = (t: string) => String(t).slice(0, 5).replace(":", " h ");

export interface EveBlock {
  title: string;
  minutes: number;
}

/** Le courriel d'une assignation (pur, testé). */
export function eveEmail(input: { firstName: string; date: string; start: string; end: string; group: string; location: string | null; theme: string | null; blocks: EveBlock[]; url: string }): { subject: string; html: string; text: string } {
  const day = new Date(`${input.date}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const when = `${day}, ${hhmm(input.start)} à ${hhmm(input.end)}`;
  const list = input.blocks.length ? input.blocks.map((b, i) => `${i + 1}. ${b.title}${b.minutes ? ` (${b.minutes} min)` : ""}`) : ["Le plan arrive : regarde le portail demain matin."];
  const subject = `Demain ${hhmm(input.start)} : ta pratique ${input.group}, à repérer avant d'arriver`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px">
<p>Bonjour ${esc(input.firstName)},</p>
<p>Ta pratique de demain : <strong>${esc(input.group)}</strong>, ${esc(when)}${input.location ? `, ${esc(input.location)}` : ""}.</p>
${input.theme ? `<p><strong>Thème :</strong> ${esc(input.theme)}</p>` : ""}
<p><strong>À avoir repéré avant d'arriver :</strong></p>
<ol style="padding-left:20px;margin:0 0 12px">${input.blocks.length ? input.blocks.map((b) => `<li>${esc(b.title)}${b.minutes ? ` <span style="color:#666">(${b.minutes} min)</span>` : ""}</li>`).join("") : "<li>Le plan arrive : regarde le portail demain matin.</li>"}</ol>
<p>Dans le portail : ouvre les diapos, lis chaque exercice et coche le guide (montage, matériel, rôles, capitaines). Les alarmes de chaque bloc sont prêtes.</p>
<p><a href="${input.url}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">Ouvrir ma pratique</a></p>
<p style="font-size:13px;color:#666;margin-top:-6px">Ou copie ce lien : <a href="${input.url}">${input.url}</a></p>
<p>Merci et bonne pratique !</p>
<p>L'équipe New Valkyria</p></div>`;
  const text = `Bonjour ${input.firstName},\n\nTa pratique de demain : ${input.group}, ${when}${input.location ? `, ${input.location}` : ""}.\n${input.theme ? `Thème : ${input.theme}\n` : ""}\nÀ avoir repéré avant d'arriver :\n${list.join("\n")}\n\nDans le portail : ouvre les diapos, lis chaque exercice et coche le guide.\n${input.url}\n\nL'équipe New Valkyria`;
  return { subject, html, text };
}

const tomorrowOf = (today: string) => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Envoie les rappels de la veille pour les pratiques de demain (une fois par assignation). */
export async function sendEveReminders(today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })): Promise<{ sent: number; skipped: number }> {
  const tomorrow = tomorrowOf(today);
  const { data: acts } = await db()
    .from("coach_activities")
    .select("id, title, category, activity_date, start_time, end_time, location, activity_type, organization")
    .eq("activity_date", tomorrow)
    .is("organization", null)
    .in("activity_type", ["Pratique", "Camp"]);
  const activities = (acts ?? []) as any[];
  if (!activities.length) return { sent: 0, skipped: 0 };
  const ids = activities.map((a) => a.id);
  const [{ data: assigns }, { data: blocks }, weekTheme] = await Promise.all([
    db().from("coach_assignments").select("id, activity_id, status, eve_reminder_sent_at, coach:coaches(first_name, email, status)").in("activity_id", ids).is("eve_reminder_sent_at", null),
    db().from("activity_session_blocks").select("activity_id, block_order, custom_title, duration_minutes, exercise:exercises(title)").in("activity_id", ids).order("block_order"),
    getThemeForDate(SEASON_DB_ID, new Date(`${tomorrow}T12:00:00`)).catch(() => null)
  ]);
  const { getResendClient } = await import("@/lib/resend");
  const mail = getResendClient();
  let sent = 0;
  let skipped = 0;
  for (const a of (assigns ?? []) as any[]) {
    const coach = a.coach;
    if (!coach?.email || coach.status === "inactive" || a.status === "absent") {
      skipped++;
      continue;
    }
    const act = activities.find((x) => x.id === a.activity_id);
    const bl = ((blocks ?? []) as any[]).filter((b) => b.activity_id === a.activity_id).map((b) => ({ title: String(b.exercise?.title || b.custom_title || "Bloc"), minutes: Number(b.duration_minutes) || 0 }));
    const m = eveEmail({
      firstName: String(coach.first_name ?? "").trim() || "coach",
      date: tomorrow,
      start: act.start_time,
      end: act.end_time,
      group: act.title || act.category || "Pratique",
      location: act.location ?? null,
      theme: weekTheme ? (themeFor(weekTheme, cleanCategory(act.category)) ?? weekTheme.theme ?? null) : null,
      blocks: bl,
      url: `${env.publicSiteUrl}/entraineur/activites/${act.id}`
    });
    // Réserver d'abord (jamais deux courriels), puis envoyer.
    const { data: claimed } = await db().from("coach_assignments").update({ eve_reminder_sent_at: new Date().toISOString() }).eq("id", a.id).is("eve_reminder_sent_at", null).select("id");
    if (!claimed?.length) continue;
    const res = await mail.emails.send({ to: coach.email, subject: m.subject, html: m.html, text: m.text } as never);
    if ((res as { error: unknown }).error) {
      await db().from("coach_assignments").update({ eve_reminder_sent_at: null }).eq("id", a.id);
      skipped++;
    } else sent++;
  }
  return { sent, skipped };
}

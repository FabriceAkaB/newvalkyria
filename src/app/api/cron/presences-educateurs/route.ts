import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getPayrollRows, holdDetail, type PayrollRow } from "@/lib/coach-payroll-data";
import { markPresenceReminded } from "@/lib/coach-portal-repo";
import { activityEndMs } from "@/lib/coach-report";
import { getCoaches } from "@/lib/coaches-repo";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { getResendClient, isEmailConfigured } from "@/lib/resend";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateFr = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });

/** Relance des éducateurs (P8.3.05, AU20) : Vercel Cron 2 fois par jour. Une activité finie depuis plus de 24 h
 *  dont la présence n'est pas confirmée ou le rapport incomplet = un courriel à l'éducateur (une seule fois par
 *  activité), sans aucune donnée d'enfant. Sans courriel au dossier, « Aujourd'hui » dit à JP de l'appeler. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cron = env.cronSecret && auth === `Bearer ${env.cronSecret}`;
  if (!cron && !(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);

  const now = Date.now();
  const [rows, coaches] = await Promise.all([getPayrollRows(), getCoaches()]);
  const due = rows.filter((r) => r.hold && !r.reminderSentAt && activityEndMs(String(r.activityDate).slice(0, 10), r.activityEnd) + DAY_MS <= now);
  const byCoach = new Map<string, PayrollRow[]>();
  for (const r of due) byCoach.set(r.coachId, [...(byCoach.get(r.coachId) ?? []), r]);

  const sent: string[] = [];
  const noEmail: string[] = [];
  for (const [coachId, list] of byCoach) {
    const coach = coaches.find((c) => c.id === coachId);
    if (!coach?.email || !isEmailConfigured()) {
      noEmail.push(list[0].coachName);
      continue;
    }
    const items = list
      .map((r) => `<li style="margin-bottom:8px"><a href="${env.publicSiteUrl}/entraineur/activites/${r.activityId}" style="color:#5b3fd1;font-weight:bold">${dateFr(r.activityDate)}, ${r.activityStart}</a> · ${r.activityLabel}<br><span style="color:#666">${holdDetail(r)}</span></li>`)
      .join("");
    await getResendClient().emails.send({
      from: env.resendFrom,
      to: coach.email,
      subject: list.length > 1 ? `${list.length} rapports de pratique à compléter` : `Ton rapport de pratique du ${dateFr(list[0].activityDate)}`,
      html: `
        <div style="font-family:-apple-system,Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
          <p>Bonjour ${coach.first_name},</p>
          <p>Il manque ${list.length > 1 ? "ces informations" : "une information"} dans ton portail pour ${list.length > 1 ? "ces activités" : "cette activité"} :</p>
          <ul style="padding-left:18px">${items}</ul>
          <p>Tes heures comptent pour la paie dès que ta présence est confirmée et que les présences et évaluations des joueuses sont remplies.</p>
          <p style="margin:24px 0"><a href="${env.publicSiteUrl}/entraineur/dashboard" style="background:#7c4dff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Ouvrir mon portail</a></p>
        </div>`
    });
    await markPresenceReminded(list.map((r) => r.assignmentId));
    sent.push(coach.first_name);
  }
  return NextResponse.json({ ok: true, due: due.length, sent, noEmail });
}

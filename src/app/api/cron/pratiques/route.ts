import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { OWNER_NOTIFY_EMAIL } from "@/lib/email";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { listPractices } from "@/lib/practices-repo";
import { getResendClient, isEmailConfigured } from "@/lib/resend";
import { sendDueEmails } from "@/lib/scheduled-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Rappel des pratiques en rouge (AU21) : Vercel Cron 2 fois par jour (8 h et 16 h, heure de Montréal).
 *  Un courriel à JP seulement s'il y a au moins une pratique sans plan à 3 jours ou moins. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cron = env.cronSecret && auth === `Bearer ${env.cronSecret}`;
  if (!cron && !(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  // Filet de sécurité : les courriels programmés (« prévenir les parents à 8 h ») partent aussi à ce passage de 8 h et 16 h,
  // au cas où le passage horaire (api/cron/mcs-robot) n'aurait pas roulé. Un courriel n'est jamais envoyé deux fois (réservé avant l'envoi).
  await sendDueEmails().catch(() => null);
  const practices = await listPractices();
  const red = practices.filter((p) => p.readiness === "rouge");
  const yellow = practices.filter((p) => p.readiness === "jaune");
  if (!red.length || !isEmailConfigured()) return NextResponse.json({ ok: true, red: red.length, emailed: false });
  const li = (p: (typeof red)[number]) => `<li><strong>${p.date} ${p.start}</strong> — ${p.group}${p.organization ? ` (${p.organization})` : ""} · ${p.daysLeft === 0 ? "aujourd'hui" : `dans ${p.daysLeft} jour(s)`}</li>`;
  await getResendClient().emails.send({
    from: env.resendFrom,
    to: OWNER_NOTIFY_EMAIL,
    subject: `🔴 ${red.length} pratique${red.length > 1 ? "s" : ""} à préparer d'urgence`,
    html: `
      <div style="font-family:-apple-system,Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
        <h1 style="font-size:20px">${red.length} pratique${red.length > 1 ? "s" : ""} sans plan à 3 jours ou moins</h1>
        <ul style="padding-left:18px">${red.map(li).join("")}</ul>
        ${yellow.length ? `<p>Et ${yellow.length} en jaune (cette semaine).</p>` : ""}
        <p style="margin:24px 0"><a href="${env.publicSiteUrl}/admin/pratiques" style="background:#7c4dff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Préparer maintenant</a></p>
        <p style="color:#666;font-size:13px">Objectif : chaque pratique prête 2 semaines d'avance.</p>
      </div>`
  });
  return NextResponse.json({ ok: true, red: red.length, emailed: true });
}

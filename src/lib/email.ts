import { env } from "@/lib/env";
import { getResendClient } from "@/lib/resend";
import type { LeadFormPayload } from "@/lib/validations";

interface ConfirmationEmailInput {
  to: string;
  parentName: string;
}

export async function sendLeadNotificationEmail(lead: LeadFormPayload) {
  if (!env.resendApiKey) return;

  const resend = getResendClient();

  await resend.emails.send({
    from: env.resendFrom,
    to: "jpaka06@gmail.com",
    subject: `Nouvelle inscription — ${lead.parent_name}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a2e;max-width:600px">
        <h2 style="font-size:20px;margin-bottom:4px">Nouvelle inscription reçue</h2>
        <p style="color:#666;font-size:13px;margin-top:0">New Valkyria · ${new Date().toLocaleString("fr-CA", { timeZone: "America/Toronto" })}</p>

        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
          <tr style="background:#f4f0fb">
            <td style="padding:8px 12px;font-weight:bold;width:40%">Parent</td>
            <td style="padding:8px 12px">${lead.parent_name}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:bold;background:#fafafa">Courriel</td>
            <td style="padding:8px 12px"><a href="mailto:${lead.email}">${lead.email}</a></td>
          </tr>
          <tr style="background:#f4f0fb">
            <td style="padding:8px 12px;font-weight:bold">Téléphone</td>
            <td style="padding:8px 12px"><a href="tel:${lead.phone}">${lead.phone}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:bold;background:#fafafa">Ville</td>
            <td style="padding:8px 12px">${lead.city}</td>
          </tr>
          <tr style="background:#f4f0fb">
            <td style="padding:8px 12px;font-weight:bold">Âge joueuse</td>
            <td style="padding:8px 12px">${lead.player_age} ans</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:bold;background:#fafafa">Niveau</td>
            <td style="padding:8px 12px">${lead.player_level}</td>
          </tr>
          <tr style="background:#f4f0fb">
            <td style="padding:8px 12px;font-weight:bold">Objectif</td>
            <td style="padding:8px 12px">${lead.goal}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:bold;background:#fafafa">Disponibilités</td>
            <td style="padding:8px 12px">${lead.availability}</td>
          </tr>
        </table>

        <p style="margin-top:24px;font-size:13px;color:#888">Ce message a été envoyé automatiquement par le site New Valkyria.</p>
      </div>
    `
  });
}

export async function sendConfirmationEmail(input: ConfirmationEmailInput) {
  if (!env.resendApiKey) {
    return;
  }

  const resend = getResendClient();

  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    subject: "New Valkyria - Confirmation d'inscription",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#161419;max-width:600px">
        <h1 style="font-size:22px">Merci ${input.parentName}, votre inscription est confirmée.</h1>
        <p>Nous avons bien reçu votre paiement pour le programme New Valkyria.</p>
        <p>Notre équipe vous contacte sous 24h pour finaliser la place de votre fille.</p>
        <p style="margin-top:24px">New Valkyria<br/>Académie féminine technique</p>
      </div>
    `
  });
}

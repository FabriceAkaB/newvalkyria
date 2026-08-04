import { env } from "@/lib/env";
import { getResendClient } from "@/lib/resend";
import { getTrialConfig } from "@/lib/trial-dates-store";
import type { LeadFormPayload } from "@/lib/validations";

interface ConfirmationEmailInput {
  to: string;
  parentName: string;
  programName?: string;
}

interface TrialEmailInput {
  to: string;
  parentName: string;
  childName?: string;
  trialYear: string;
}

export async function sendLeadNotificationEmail(lead: LeadFormPayload) {
  if (!env.resendApiKey) return;

  const resend = getResendClient();

  await resend.emails.send({
    from: env.resendFrom,
    to: "info@newvalkyria.com",
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

export async function sendTrialConfirmationEmail(input: TrialEmailInput) {
  if (!env.resendApiKey) return;

  const resend = getResendClient();
  const config = getTrialConfig();
  const groups = config.groups[input.trialYear] ?? [];

  const groupsHtml = groups.map((g) => `
    <div style="margin-top:18px;padding:14px 16px;background:#f6f1fb;border-radius:8px;border-left:3px solid #8b5cf6">
      <p style="margin:0 0 8px 0;font-weight:bold;font-size:14px;color:#3b1d6e">${g.label}</p>
      <p style="margin:0 0 6px 0;font-size:13px"><strong>Dates :</strong> ${g.dates.join(" · ")}</p>
      ${g.horaires.map((h) => `<p style="margin:2px 0;font-size:13px;color:#4a4a6a">${h}</p>`).join("")}
      ${g.exception ? `<p style="margin:6px 0 0 0;font-size:12px;color:#b45309;font-style:italic">⚠ ${g.exception}</p>` : ""}
    </div>
  `).join("");

  const childLine = input.childName
    ? `<p style="font-size:15px">Votre fille <strong>${input.childName}</strong> est inscrite à l'essai gratuit ! 🎉</p>`
    : `<p style="font-size:15px">Votre inscription à l'essai gratuit est confirmée ! 🎉</p>`;

  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    subject: "✓ Votre essai gratuit est confirmé — New Valkyria",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a1a2e;max-width:600px;padding:24px">
        <div style="text-align:center;margin-bottom:20px">
          <h1 style="font-size:24px;color:#3b1d6e;margin:0">NEW VALKYRIA</h1>
          <p style="color:#888;font-size:13px;margin:4px 0 0 0;letter-spacing:1px">ESSAI GRATUIT CONFIRMÉ</p>
        </div>

        <p style="font-size:16px">Bonjour ${input.parentName},</p>
        ${childLine}
        <p>Voici toutes les informations pour les <strong>3 séances d'essai gratuites</strong> :</p>

        ${groupsHtml}

        <div style="margin-top:24px;padding:16px;background:#fff8e1;border-radius:8px;border-left:3px solid #f59e0b">
          <p style="margin:0 0 6px 0;font-weight:bold;font-size:14px">📍 Lieu</p>
          <p style="margin:0;font-size:13px">${config.lieu}</p>
          <p style="margin:8px 0 0 0;font-size:12px;color:#92400e;font-style:italic">* ${config.lieuNote}</p>
        </div>

        <div style="margin-top:24px;padding:16px;background:#f0f9ff;border-radius:8px">
          <p style="margin:0 0 8px 0;font-weight:bold;font-size:14px">Ce que vous devez prévoir</p>
          <ul style="margin:0;padding-left:20px;font-size:13px;color:#4a4a6a">
            <li>Souliers de soccer (crampons multi-surfaces ou turf)</li>
            <li>Vêtements de sport confortables</li>
            <li>Bouteille d'eau</li>
            <li>Bonne énergie ! ⚡</li>
          </ul>
        </div>

        <p style="margin-top:24px;font-size:14px">Une question ? Répondez à ce courriel ou contactez-nous :</p>
        <p style="font-size:14px">
          📧 <a href="mailto:info@newvalkyria.com">info@newvalkyria.com</a><br/>
          📞 <a href="tel:+15146883600">514 688-3600</a>
        </p>

        <p style="margin-top:32px;font-size:13px;color:#888;border-top:1px solid #eee;padding-top:16px">
          À très bientôt sur le terrain !<br/>
          <strong>L'équipe New Valkyria</strong>
        </p>
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
        <p>Nous avons bien reçu votre paiement pour le programme ${input.programName ?? "New Valkyria"}.</p>
        <p>Notre équipe vous contacte sous 24h pour finaliser la place de votre fille.</p>
        <p style="margin-top:24px">New Valkyria<br/>Académie féminine technique</p>
      </div>
    `
  });
}

interface SeasonTrialEmailInput {
  to: string;
  parentName: string;
}

/** Confirmation envoyée au parent pour un essai gratuit (saison en base de
 *  données) — distincte de sendTrialConfirmationEmail qui sert l'ancien
 *  système d'essai (leads + horaires configurés dans trial-dates-store). */
export async function sendSeasonTrialConfirmationEmail(input: SeasonTrialEmailInput) {
  if (!env.resendApiKey) return;

  const resend = getResendClient();

  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    subject: "New Valkyria - Confirmation de votre essai gratuit",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#161419;max-width:600px">
        <h1 style="font-size:22px">Merci ${input.parentName}, votre essai gratuit est confirmé.</h1>
        <p>Nous avons bien reçu votre demande d'essai gratuit.</p>
        <p>Notre équipe vous contacte sous 24h pour planifier la séance de votre fille.</p>
        <p style="margin-top:24px">New Valkyria<br/>Académie féminine technique</p>
      </div>
    `
  });
}

interface ShopOrderEmailInput {
  to: string;
  customerName: string;
  items: { productName: string; variantLabel: string | null; unitPriceCents: number; quantity: number }[];
  totalCents: number;
}

export async function sendShopOrderConfirmationEmail(input: ShopOrderEmailInput) {
  if (!env.resendApiKey) return;

  const resend = getResendClient();
  const fmt = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  const rowsHtml = input.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px">${item.productName}${item.variantLabel ? ` — ${item.variantLabel}` : ""} × ${item.quantity}</td>
        <td style="padding:8px 12px;text-align:right">${fmt(item.unitPriceCents * item.quantity)}</td>
      </tr>`
    )
    .join("");

  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    subject: "New Valkyria - Confirmation de votre commande",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#161419;max-width:600px">
        <h1 style="font-size:22px">Merci ${input.customerName}, votre commande est confirmée.</h1>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
          ${rowsHtml}
          <tr style="font-weight:bold;border-top:1px solid #ddd">
            <td style="padding:8px 12px">Total</td>
            <td style="padding:8px 12px;text-align:right">${fmt(input.totalCents)}</td>
          </tr>
        </table>
        <p style="margin-top:24px">Notre équipe prépare votre commande et vous contactera pour la remise.</p>
        <p style="margin-top:24px">New Valkyria<br/>Académie féminine technique</p>
      </div>
    `
  });
}

interface InstallmentReceiptEmailInput {
  to: string;
  parentName: string;
  amountCents: number;
  installmentNumber: number;
  installmentCount: number;
}

export async function sendInstallmentReceiptEmail(input: InstallmentReceiptEmailInput) {
  if (!env.resendApiKey) return;

  const resend = getResendClient();
  const fmt = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    subject: `New Valkyria - Versement ${input.installmentNumber}/${input.installmentCount} reçu`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#161419;max-width:600px">
        <h1 style="font-size:22px">Merci ${input.parentName}, votre versement a été traité.</h1>
        <p>Versement ${input.installmentNumber} sur ${input.installmentCount} : ${fmt(input.amountCents)}</p>
        <p style="margin-top:24px">New Valkyria<br/>Académie féminine technique</p>
      </div>
    `
  });
}

interface PaymentPlanFailedEmailInput {
  parentName: string;
  parentEmail: string;
  amountCents: number;
  installmentNumber: number;
  installmentCount: number;
  attemptNumber: number;
  finalAttempt: boolean;
}

/** Notification interne envoyée à l'académie (pas au parent) dès le premier
 *  échec de prélèvement d'un versement, et à nouveau si le suivi manuel
 *  devient nécessaire après le nombre maximal de tentatives automatiques. */
export async function sendPaymentPlanFailedEmail(input: PaymentPlanFailedEmailInput) {
  if (!env.resendApiKey) return;

  const resend = getResendClient();
  const fmt = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  await resend.emails.send({
    from: env.resendFrom,
    to: "info@newvalkyria.com",
    subject: input.finalAttempt
      ? `New Valkyria - Suivi manuel requis : échec de paiement (${input.parentName})`
      : `New Valkyria - Échec d'un versement (${input.parentName})`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#161419;max-width:600px">
        <h1 style="font-size:22px">${input.finalAttempt ? "Suivi manuel requis" : "Un versement a échoué"}</h1>
        <p><strong>${input.parentName}</strong> (${input.parentEmail})</p>
        <p>Versement ${input.installmentNumber} sur ${input.installmentCount} : ${fmt(input.amountCents)}</p>
        <p>Tentative ${input.attemptNumber}${input.finalAttempt ? " — les réessais automatiques sont maintenant arrêtés." : " — un réessai automatique aura lieu demain."}</p>
      </div>
    `
  });
}

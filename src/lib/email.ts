import { env } from "@/lib/env";
import { getMailConfig } from "@/lib/mail-config";
import { getResendClient, isEmailConfigured } from "@/lib/resend";
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
  if (!isEmailConfigured()) return;

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
  if (!isEmailConfigured()) return;

  const resend = getResendClient();
  const config = await getTrialConfig();
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
  if (!isEmailConfigured()) {
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
  if (!isEmailConfigured()) return;

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

interface WaitlistEmailInput {
  to: string;
  parentName: string;
  programName: string;
}

export async function sendWaitlistConfirmationEmail(input: WaitlistEmailInput) {
  if (!isEmailConfigured()) return;

  const resend = getResendClient();

  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    subject: "New Valkyria - Vous êtes sur la liste d'attente",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#161419;max-width:600px">
        <h1 style="font-size:22px">Merci ${input.parentName}, vous êtes sur la liste d'attente.</h1>
        <p>Le programme ${input.programName} est complet pour le moment.</p>
        <p>Nous vous contactons dès qu'une place se libère.</p>
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
  if (!isEmailConfigured()) return;

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
  if (!isEmailConfigured()) return;

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
  if (!isEmailConfigured()) return;

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

/** Diffusion ciblée depuis le centre de communication admin — même client
 *  Resend que les autres courriels transactionnels, un envoi par
 *  destinataire (cohérent avec le reste de ce fichier, aucune API "batch"
 *  utilisée ailleurs dans le projet). Le corps est du texte brut composé
 *  par l'admin ; on ne rend jamais de HTML arbitraire, seulement les sauts
 *  de ligne convertis en paragraphes. */
export async function sendBroadcastEmail(input: { to: string; subject: string; body: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isEmailConfigured()) return { ok: false, error: "Resend non configuré" };

  const resend = getResendClient();
  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

  try {
    await resend.emails.send({
      from: env.resendFrom,
      to: input.to,
      subject: input.subject,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#161419;max-width:600px">
          ${paragraphs}
          <p style="margin-top:24px;font-size:13px;color:#888">New Valkyria</p>
        </div>
      `
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur d'envoi" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface PrivateProgramConfirmationInput {
  to: string;
  parentName: string;
  playerName: string;
  programName: string;
  practices: number | null;
  matches: number | null;
  listPriceCents: number;
  referralDiscountCents: number;
  creditAppliedCents: number;
  installmentFeeCents: number;
  totalCents: number;
  paidCents: number;
  nextInstallmentDate: string | null;
  nextInstallmentCents: number | null;
  accountUrl: string;
  /** « atlantic » : courriel signé FC Atlantic, sans espace parent ni recommandations. */
  brand?: "nv" | "atlantic";
}

/** Confirmation d'inscription à un programme garçons privé : détail complet
 *  du prix, du rabais, du montant payé et du solde (bloc 6.3). */
export async function sendPrivateProgramConfirmationEmail(input: PrivateProgramConfirmationInput) {
  if (!isEmailConfigured()) return;

  const resend = getResendClient();
  const fmt = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  const remaining = Math.max(0, input.totalCents - input.paidCents);
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 10px;${bold ? "font-weight:bold;" : ""}">${label}</td><td style="padding:6px 10px;text-align:right;${bold ? "font-weight:bold;" : ""}">${value}</td></tr>`;

  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    subject: `${input.brand === "atlantic" ? "FC Atlantic" : "New Valkyria"} — Inscription confirmée : ${input.playerName}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
        <h1 style="font-size:22px;margin-bottom:6px">Merci ${escapeHtml(input.parentName)}, l'inscription est confirmée.</h1>
        <p style="margin-top:0"><strong>${escapeHtml(input.playerName)}</strong> est inscrit au programme <strong>${escapeHtml(input.programName)}</strong>.</p>
        ${input.practices || input.matches ? `<p>Le programme comprend ${input.practices ?? "—"} pratiques${input.matches ? ` et ${input.matches} matchs` : ""}. Le calendrier détaillé vous sera communiqué.</p>` : ""}
        <table style="width:100%;border-collapse:collapse;font-size:14px;background:#f7f4fb;margin:14px 0">
          ${row("Prix du programme", fmt(input.listPriceCents))}
          ${input.referralDiscountCents > 0 ? row("Rabais de référencement", `− ${fmt(input.referralDiscountCents)}`) : ""}
          ${input.creditAppliedCents > 0 ? row("Crédit familial utilisé", `− ${fmt(input.creditAppliedCents)}`) : ""}
          ${input.installmentFeeCents > 0 ? row("Supplément — paiement en 2 versements", `+ ${fmt(input.installmentFeeCents)}`) : ""}
          ${row("Total", fmt(input.totalCents), true)}
          ${row("Montant payé", fmt(input.paidCents))}
          ${row("Solde restant", fmt(remaining), true)}
        </table>
        ${
          remaining > 0 && input.nextInstallmentDate
            ? `<p>Le prochain versement de <strong>${fmt(input.nextInstallmentCents ?? remaining)}</strong> sera prélevé automatiquement sur la carte utilisée le <strong>${new Date(input.nextInstallmentDate + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}</strong>, comme vous l'avez autorisé. Un rappel vous sera envoyé avant la date.</p>`
            : ""
        }
        ${input.brand === "atlantic" ? "" : `<p>Vous pouvez consulter votre dossier et vos recommandations dans votre espace parent : <a href="${input.accountUrl}">${input.accountUrl}</a></p>`}
        <p style="margin-top:24px">${input.brand === "atlantic" ? "FC Atlantic" : "New Valkyria<br/>info@newvalkyria.com"}</p>
      </div>
    `
  });
}

interface InstallmentReminderInput {
  to: string;
  parentName: string;
  playerName: string;
  programName: string;
  amountCents: number;
  dueDate: string;
}

/** Rappel envoyé quelques jours avant le prélèvement automatique du 2e versement. */
export async function sendInstallmentReminderEmail(input: InstallmentReminderInput) {
  if (!isEmailConfigured()) return;
  const resend = getResendClient();
  const fmt = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    subject: `New Valkyria — Rappel : versement de ${fmt(input.amountCents)} le ${new Date(input.dueDate + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
        <h1 style="font-size:20px">Bonjour ${escapeHtml(input.parentName)},</h1>
        <p>Petit rappel : le deuxième versement du programme <strong>${escapeHtml(input.programName)}</strong> pour <strong>${escapeHtml(input.playerName)}</strong> sera prélevé automatiquement sur la carte enregistrée le <strong>${new Date(input.dueDate + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}</strong>.</p>
        <p>Montant : <strong>${fmt(input.amountCents)}</strong>. Si votre carte a changé, écrivez-nous à info@newvalkyria.com avant cette date.</p>
        <p style="margin-top:24px">New Valkyria</p>
      </div>
    `
  });
}

interface TerrainRentalEmailInput {
  to: string;
  contactName: string;
  organizationName: string;
  terrainName: string;
  terrainAddress: string | null;
  date: string;
  start: string;
  end: string;
  priceCents: number;
}

/** Confirmation d'une location de terrain payée — au locataire, copie à l'académie. */
export async function sendTerrainRentalConfirmationEmail(input: TerrainRentalEmailInput) {
  if (!isEmailConfigured()) return;
  const resend = getResendClient();
  const fmt = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  const dateLabel = new Date(input.date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
      <h1 style="font-size:22px">Réservation confirmée</h1>
      <p>Bonjour ${escapeHtml(input.contactName)}, la réservation de <strong>${escapeHtml(input.organizationName)}</strong> est confirmée.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;background:#f7f4fb;margin:14px 0">
        <tr><td style="padding:6px 10px;font-weight:bold">Terrain</td><td style="padding:6px 10px">${escapeHtml(input.terrainName)}${input.terrainAddress ? `<br/>${escapeHtml(input.terrainAddress)}` : ""}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold">Date</td><td style="padding:6px 10px">${dateLabel}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold">Heure</td><td style="padding:6px 10px">${input.start} – ${input.end}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold">Montant payé</td><td style="padding:6px 10px">${fmt(input.priceCents)}</td></tr>
      </table>
      <p>Pour toute question ou modification : info@newvalkyria.com.</p>
      <p style="margin-top:24px">New Valkyria</p>
    </div>`;
  await resend.emails.send({ from: env.resendFrom, to: input.to, bcc: "info@newvalkyria.com", subject: `New Valkyria — Réservation de terrain confirmée (${dateLabel})`, html });
}

/** Envoi d'un courriel promotionnel déjà composé (campagne « Partagez New Valkyria »).
 *  Part de la boîte configurée (Gmail / Google Workspace) sinon de Resend. */
export async function sendCampaignEmail(input: { to: string; subject: string; html: string; text: string }): Promise<{ ok: true; via: "gmail" | "resend" } | { ok: false; error: string }> {
  const cfg = await getMailConfig();
  try {
    const { error } = await getResendClient().emails.send({
      from: env.resendFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: cfg ? cfg.user : "info@newvalkyria.com"
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, via: cfg ? "gmail" : "resend" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur d'envoi" };
  }
}

interface MatchSlotsEmailInput {
  to: string;
  contactName: string;
  orgName: string;
  teamLabel: string;
  slots: {
    date: string;
    start: string;
    end: string;
    location: string;
    format?: string | null;
    opponent?: string | null;
    /** Vrai si la plage fait partie d'une double cédule (deux matchs consécutifs). */
    double?: boolean;
    depositCents: number;
    balanceCents: number;
  }[];
}

/** Confirmation d'une réservation de match payée (équipe extérieure) — copie à l'académie. */
export async function sendMatchSlotsConfirmationEmail(input: MatchSlotsEmailInput) {
  const resend = getResendClient();
  const fmt = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  const deposit = input.slots.reduce((n, s) => n + s.depositCents, 0);
  const balance = input.slots.reduce((n, s) => n + s.balanceCents, 0);
  const hasDouble = input.slots.some((s) => s.double);
  const rows = input.slots
    .map((s) => {
      const label = new Date(s.date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      const details = [
        s.double ? "Double cédule (deux matchs consécutifs)" : null,
        s.format ? `Format : ${escapeHtml(s.format)}` : null,
        `Adversaire : ${escapeHtml(s.opponent?.trim() || "à confirmer par New Valkyria")}`
      ]
        .filter(Boolean)
        .join(" · ");
      return `<tr><td style="padding:8px 10px;border-bottom:1px solid #e6e1ee"><strong>${label}</strong><br/>${s.start} – ${s.end}<br/><span style="font-size:13px">${details}</span><br/><span style="color:#6d6880;font-size:13px">${escapeHtml(s.location)}</span></td></tr>`;
    })
    .join("");
  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    bcc: "info@newvalkyria.com",
    subject: `New Valkyria — Match confirmé : ${input.slots.length > 1 ? `${input.slots.length} plages` : "1 plage"} réservée${input.slots.length > 1 ? "s" : ""}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
        <h1 style="font-size:22px">Réservation confirmée</h1>
        <p>Bonjour ${escapeHtml(input.contactName)}, les plages suivantes sont réservées pour <strong>${escapeHtml(input.orgName)}</strong> (${escapeHtml(input.teamLabel)}) :</p>
        <table style="width:100%;border-collapse:collapse;background:#f7f4fb;margin:14px 0">${rows}</table>
        ${hasDouble ? `<p style="font-size:14px">Une double cédule comprend deux matchs de suite : votre équipe joue les deux matchs, ou vous pouvez aligner deux équipes.</p>` : ""}
        <table style="font-size:14px;margin:6px 0 14px">
          <tr><td style="padding:3px 14px 3px 0">Acompte payé aujourd'hui</td><td><strong>${fmt(deposit)}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0">Solde à payer le jour du match</td><td><strong>${fmt(balance)}</strong></td></tr>
          <tr><td style="padding:3px 14px 3px 0">Total</td><td><strong>${fmt(deposit + balance)}</strong></td></tr>
        </table>
        <p>Le solde est payable sur place, le jour du match. Nous vous contacterons pour les derniers détails (arrivée, équipement).</p>
        <p style="margin-top:24px">New Valkyria<br/>info@newvalkyria.com</p>
      </div>`
  });
}

interface BoysTrialEmailInput {
  to: string;
  parentName: string;
  playerName: string;
  programName: string;
  date: string;
  start: string;
  end: string;
  location: string;
}

/** Confirmation d'un essai gratuit (mardi) — copie à l'académie. */
export async function sendBoysTrialConfirmationEmail(input: BoysTrialEmailInput) {
  const resend = getResendClient();
  const label = new Date(input.date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    bcc: "info@newvalkyria.com",
    subject: `New Valkyria — Essai gratuit confirmé : ${input.playerName}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
        <h1 style="font-size:22px">Essai gratuit confirmé</h1>
        <p>Bonjour ${escapeHtml(input.parentName)}, <strong>${escapeHtml(input.playerName)}</strong> est attendu pour un essai gratuit au programme <strong>${escapeHtml(input.programName)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;background:#f7f4fb;margin:14px 0">
          <tr><td style="padding:8px 10px;font-weight:bold">Date</td><td style="padding:8px 10px">${label}</td></tr>
          <tr><td style="padding:8px 10px;font-weight:bold">Heure</td><td style="padding:8px 10px">${input.start} – ${input.end}</td></tr>
          <tr><td style="padding:8px 10px;font-weight:bold">Lieu</td><td style="padding:8px 10px">${escapeHtml(input.location)}</td></tr>
        </table>
        <p>Merci d'arriver 10 minutes à l'avance, avec des souliers d'intérieur et une bouteille d'eau. Pour toute question : info@newvalkyria.com.</p>
        <p style="margin-top:24px">New Valkyria</p>
      </div>`
  });
}

interface SponsorshipPaidEmailInput {
  company: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  sector: string | null;
  tierLabel: string;
  placement: string;
  amountCents: number;
}

/** Avis interne : une commandite 2027 vient d'être payée par lien Stripe. */
export async function sendSponsorshipPaidNotification(input: SponsorshipPaidEmailInput) {
  const resend = getResendClient();
  const fmt = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  const row = (label: string, value: string | null) =>
    value ? `<tr><td style="padding:6px 10px;font-weight:bold;white-space:nowrap">${label}</td><td style="padding:6px 10px">${escapeHtml(value)}</td></tr>` : "";
  await resend.emails.send({
    from: env.resendFrom,
    to: "info@newvalkyria.com",
    subject: `Commandite payée — ${input.company} (${input.tierLabel}, ${fmt(input.amountCents)})`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
        <h1 style="font-size:20px">Nouvelle commandite payée</h1>
        <table style="border-collapse:collapse;font-size:14px;background:#f7f4fb;width:100%">
          ${row("Entreprise", input.company)}
          ${row("Forfait", `${input.tierLabel} — ${input.placement}`)}
          ${row("Montant", fmt(input.amountCents))}
          ${row("Secteur", input.sector)}
          ${row("Responsable", input.contactName)}
          ${row("Courriel", input.contactEmail)}
          ${row("Téléphone", input.contactPhone)}
        </table>
        <p style="margin-top:16px">La commandite est inscrite dans l'admin (Commandites) avec le statut « Payé ». Prochaine étape : récupérer le logo et confirmer l'emplacement.</p>
      </div>`
  });
}

const PROGRAM_EMAIL_LABEL: Record<string, string> = {
  "intensif-garcons": "Programme Intensif garçons",
  "garcons-2018": "Programme de développement garçons 2018",
  "garcons-2014-2015": "Programme de développement garçons 2014–2015"
};

export function programEmailLabel(slug: string): string {
  return PROGRAM_EMAIL_LABEL[slug] ?? "programme New Valkyria";
}

/** Courriel envoyé à une famille qui a déjà payé mais n'a pas rempli le formulaire du joueur. */
export async function sendRegistrationCompletionRequestEmail(input: { to: string; parentName: string | null; programSlug: string; amountCents: number; link: string }) {
  const resend = getResendClient();
  const fmt = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  const hello = input.parentName ? `Bonjour ${escapeHtml(input.parentName)},` : "Bonjour,";
  const label = escapeHtml(programEmailLabel(input.programSlug));
  const result = await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    bcc: "info@newvalkyria.com",
    subject: "New Valkyria — Dernière étape : le formulaire de votre fils",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
        <h1 style="font-size:22px">Dernière étape de l'inscription</h1>
        <p>${hello}</p>
        <p>Merci ! Nous avons bien reçu votre paiement de <strong>${fmt(input.amountCents)}</strong> pour le <strong>${label}</strong>.</p>
        <p>Il nous manque seulement les informations de votre fils pour compléter son dossier et l'ajouter à la liste des joueurs. Cela prend moins de deux minutes :</p>
        <p style="margin:22px 0"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#72499a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 22px;border-radius:8px">Remplir le formulaire</a></p>
        <p style="font-size:13px;color:#6d6880">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/><a href="${escapeHtml(input.link)}" style="color:#72499a;word-break:break-all">${escapeHtml(input.link)}</a></p>
        <p>Aucun nouveau paiement n'est demandé. Pour toute question : info@newvalkyria.com</p>
        <p style="margin-top:24px">New Valkyria</p>
      </div>`,
    text: `${input.parentName ? `Bonjour ${input.parentName},` : "Bonjour,"}\n\nNous avons bien reçu votre paiement de ${fmt(input.amountCents)} pour le ${programEmailLabel(input.programSlug)}.\nIl nous manque seulement les informations de votre fils pour compléter son dossier :\n${input.link}\n\nAucun nouveau paiement n'est demandé.\nNew Valkyria — info@newvalkyria.com`
  });
  if ((result as any)?.error) throw new Error((result as any).error.message ?? "Envoi impossible");
}

/** Confirmation une fois le formulaire rempli. */
export async function sendRegistrationCompletedEmail(input: { to: string; parentName: string; playerName: string; programSlug: string }) {
  const resend = getResendClient();
  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    bcc: "info@newvalkyria.com",
    subject: `New Valkyria — Inscription confirmée : ${input.playerName}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
        <h1 style="font-size:22px">Inscription confirmée</h1>
        <p>Merci ${escapeHtml(input.parentName)} ! <strong>${escapeHtml(input.playerName)}</strong> est maintenant inscrit au <strong>${escapeHtml(programEmailLabel(input.programSlug))}</strong>.</p>
        <p>Nous vous enverrons les détails des pratiques et des matchs. Pour toute question : info@newvalkyria.com</p>
        <p style="margin-top:24px">New Valkyria</p>
      </div>`
  });
}

/** Équipe extérieure : son lien personnel pour réserver des matchs sans refaire le formulaire. */
export async function sendMatchTeamLinkEmail(input: { to: string; contactName: string; orgName: string; teamLabel: string; link: string }) {
  const resend = getResendClient();
  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    bcc: "info@newvalkyria.com",
    subject: `New Valkyria — Votre équipe est enregistrée (${input.orgName})`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
        <h1 style="font-size:21px">Votre équipe est enregistrée</h1>
        <p>Bonjour ${escapeHtml(input.contactName)},</p>
        <p>Merci ! Les informations de <strong>${escapeHtml(input.orgName)}</strong> (${escapeHtml(input.teamLabel)}) sont enregistrées. Voici votre <strong>lien personnel</strong> pour voir les plages de match qui conviennent à votre équipe et les réserver, sans avoir à remplir le formulaire de nouveau :</p>
        <p style="margin:20px 0"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#72499a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 20px;border-radius:8px">Voir et réserver nos plages de match</a></p>
        <p style="font-size:13px;color:#6d6880">Conservez ce courriel. Lien : <a href="${escapeHtml(input.link)}" style="color:#72499a;word-break:break-all">${escapeHtml(input.link)}</a></p>
        <p>Pour toute question : info@newvalkyria.com</p>
        <p style="margin-top:22px">L'équipe New Valkyria</p>
      </div>`
  });
}

function matchSlotsText(slots: { slot_date: string; start_time: string; end_time: string; opponent?: string | null }[]) {
  return slots
    .map((s) => `${new Date(s.slot_date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}, ${s.start_time} – ${s.end_time}${s.opponent ? ` (contre ${s.opponent})` : ""}`)
    .join("<br/>");
}

/** Avis interne : une équipe demande une plage pour laquelle elle n'est pas admissible d'office. */
export async function sendMatchRequestNotification(input: { orgName: string; teamLabel: string; category: string; level: string; contactName: string; contactEmail: string; contactPhone: string; message: string | null; slots: { slot_date: string; start_time: string; end_time: string; opponent?: string | null }[] }) {
  const resend = getResendClient();
  await resend.emails.send({
    from: env.resendFrom,
    to: "info@newvalkyria.com",
    subject: `Demande de match à approuver — ${input.orgName} (${input.category})`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
      <h1 style="font-size:19px">Demande de match à approuver</h1>
      <p><strong>${escapeHtml(input.orgName)}</strong> — ${escapeHtml(input.teamLabel)} · ${escapeHtml(input.category)} · calibre ${escapeHtml(input.level)}</p>
      <p>${escapeHtml(input.contactName)} · ${escapeHtml(input.contactEmail)} · ${escapeHtml(input.contactPhone)}</p>
      <p><strong>Plage demandée :</strong><br/>${matchSlotsText(input.slots)}</p>
      ${input.message ? `<p><strong>Message :</strong> ${escapeHtml(input.message)}</p>` : ""}
      <p>Approuvez ou refusez dans l'admin : Vente de matchs → Demandes de match.</p>
    </div>`
  });
}

/** Réponse à une équipe : demande approuvée (elle peut payer) ou refusée. */
export async function sendMatchRequestDecisionEmail(input: { to: string; contactName: string; orgName: string; approved: boolean; link: string; slots: { slot_date: string; start_time: string; end_time: string; opponent?: string | null }[] }) {
  const resend = getResendClient();
  await resend.emails.send({
    from: env.resendFrom,
    to: input.to,
    bcc: "info@newvalkyria.com",
    subject: input.approved ? "New Valkyria — Votre demande de match est approuvée" : "New Valkyria — Votre demande de match",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#161419;max-width:600px">
      <p>Bonjour ${escapeHtml(input.contactName)},</p>
      ${
        input.approved
          ? `<p>Bonne nouvelle : votre demande pour <strong>${escapeHtml(input.orgName)}</strong> est <strong>approuvée</strong>. Vous pouvez maintenant réserver et payer la plage suivante :</p>
             <p>${matchSlotsText(input.slots)}</p>
             <p style="margin:18px 0"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#72499a;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Réserver la plage</a></p>
             <p style="font-size:13px;color:#6d6880">Premier arrivé, premier servi : la plage est confirmée au paiement de l'acompte.</p>`
          : `<p>Merci pour votre intérêt. Malheureusement, nous ne pouvons pas accepter votre demande pour la plage suivante, la catégorie de votre équipe ne correspondant pas à notre groupe :</p>
             <p>${matchSlotsText(input.slots)}</p>
             <p>D'autres plages conviennent peut-être à votre équipe : <a href="${escapeHtml(input.link)}" style="color:#72499a;font-weight:bold">voir les plages</a>.</p>`
      }
      <p style="margin-top:22px">L'équipe New Valkyria<br/>info@newvalkyria.com</p>
    </div>`
  });
}

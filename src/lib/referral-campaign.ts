import { buildShareMessage, formatMoney, privateProgramUrl, shareLinks } from "@/lib/private-programs";
import { getAllPrivatePrograms, type PrivateProgram } from "@/lib/private-programs-repo";
import { getOrCreateReferralCode, normalizeEmail } from "@/lib/referrals-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface CampaignRecipient {
  email: string;
  name: string;
  firstName: string;
  code: string;
  phone: string | null;
}

export interface CampaignProgram {
  slug: string;
  shortName: string;
  priceCents: number;
  practices: number;
  matches: number;
  capacity: number;
  feeCents: number;
  referralDiscountCents: number;
  link: string;
  message: string;
  whatsapp: string;
  email: string;
  sms: string;
}

export function programShortName(p: Pick<PrivateProgram, "gender" | "birth_years">): string {
  const who = p.gender === "filles" ? "Filles" : p.gender === "mixte" ? "Joueurs" : "Garçons";
  return `${who} ${p.birth_years.replace("-", "–")}`;
}

/** Programmes promus : ouverts ET publiés seulement (jamais un brouillon). */
export async function getCampaignPrograms(origin: string, code: string): Promise<CampaignProgram[]> {
  const programs = (await getAllPrivatePrograms()).filter((p) => p.active && p.published);
  return programs.map((p) => {
    const link = privateProgramUrl(origin, p.slug, code);
    const shortName = programShortName(p);
    const message = buildShareMessage({
      program: { slug: p.slug, shortName, priceCents: p.price_cents },
      link,
      practices: p.practices_count ?? 16,
      matches: p.matches_count ?? 3,
      capacity: p.max_capacity,
      feeCents: p.installment_fee_cents,
      referralDiscountCents: p.referral_discount_cents,
      withReferralMention: true
    });
    const links = shareLinks(message, link, `Programme de soccer New Valkyria — ${shortName}`);
    return {
      slug: p.slug,
      shortName,
      priceCents: p.price_cents,
      practices: p.practices_count ?? 16,
      matches: p.matches_count ?? 3,
      capacity: p.max_capacity,
      feeCents: p.installment_fee_cents,
      referralDiscountCents: p.referral_discount_cents,
      link,
      message,
      whatsapp: links.whatsapp,
      email: links.email,
      sms: links.sms
    };
  });
}

/** Courriel promotionnel personnalisé : le code et les liens de CETTE famille,
 *  avec des boutons de partage prêts à l'emploi (WhatsApp, courriel, SMS). */
export function buildCampaignEmail(input: { firstName: string; code: string; programs: CampaignProgram[]; origin: string }): { subject: string; html: string; text: string } {
  const { firstName, code, programs, origin } = input;
  const discount = programs[0]?.referralDiscountCents ?? 5000;
  const subject = `${firstName ? firstName + ", p" : "P"}artagez New Valkyria : ${formatMoney(discount)} de rabais pour eux, une récompense pour vous`;
  const btn = (href: string, label: string, bg: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 18px;border-radius:8px;margin:4px 6px 4px 0">${label}</a>`;

  const cards = programs
    .map(
      (p) => `
      <div style="background:#f7f4fb;border:1px solid #e3dbf0;border-radius:12px;padding:16px;margin:0 0 16px">
        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#72499a;font-weight:bold">${escapeHtml(p.shortName)}</p>
        <p style="margin:4px 0 8px;font-size:20px;font-weight:bold;color:#161419">${formatMoney(p.priceCents)}</p>
        <p style="margin:0 0 12px;font-size:14px;color:#3d3852">${p.practices} pratiques · ${p.matches} matchs inclus · ${p.capacity} joueurs maximum${p.feeCents > 0 ? ` · paiement en 2 versements possible (+ ${formatMoney(p.feeCents)})` : ""}</p>
        <div>
          ${btn(p.whatsapp, "Partager sur WhatsApp", "#1f9d55")}
          ${btn(p.email, "Envoyer par courriel", "#72499a")}
          ${btn(p.sms, "Envoyer par SMS", "#3d3852")}
        </div>
        <p style="margin:10px 0 0;font-size:12px;color:#6d6880">Votre lien personnel :<br/><a href="${escapeHtml(p.link)}" style="color:#72499a;word-break:break-all">${escapeHtml(p.link)}</a></p>
      </div>`
    )
    .join("");

  const html = `
  <div style="background:#efeaf5;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden">
      <div style="background:#2a1a45;padding:22px 24px">
        <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:.06em">NEW VALKYRIA</p>
        <p style="margin:2px 0 0;color:#c8aae0;font-size:13px">Académie technique de soccer</p>
      </div>
      <div style="padding:24px;color:#161419;font-size:15px;line-height:1.55">
        <p style="margin:0 0 14px">Bonjour ${escapeHtml(firstName || "")},</p>
        <p style="margin:0 0 14px">Merci de faire partie de la famille New Valkyria. Nous lançons deux nouveaux programmes de développement et <strong>nous comptons sur vous</strong> pour en parler autour de vous.</p>
        <div style="background:#2a1a45;color:#ffffff;border-radius:12px;padding:16px 18px;margin:0 0 18px">
          <p style="margin:0 0 6px;font-weight:bold;font-size:16px">Comment ça fonctionne</p>
          <p style="margin:0;font-size:14px;line-height:1.6">
            1. Envoyez votre lien personnel à une famille.<br/>
            2. Elle s'inscrit : <strong>${formatMoney(discount)} de rabais</strong> sur l'inscription.<br/>
            3. Vous choisissez votre récompense : <strong>un sac New Valkyria</strong> ou <strong>${formatMoney(5000)} de crédit</strong> pour la prochaine saison.
          </p>
        </div>
        <p style="margin:0 0 10px;font-weight:bold">Choisissez le programme à partager — un clic et le message est prêt :</p>
        ${cards}
        <p style="margin:0 0 6px;font-size:14px">Votre code : <strong style="letter-spacing:.1em;color:#72499a">${escapeHtml(code)}</strong> (il est déjà inclus dans vos liens).</p>
        <p style="margin:0 0 18px;font-size:14px">Suivez vos recommandations et choisissez votre récompense : <a href="${origin}/compte/recommandations" style="color:#72499a;font-weight:bold">Mes recommandations</a></p>
        <p style="margin:0;font-size:14px">Merci de votre confiance,<br/><strong>L'équipe New Valkyria</strong><br/>info@newvalkyria.com</p>
      </div>
      <div style="background:#f7f4fb;padding:12px 24px;font-size:11px;color:#6d6880">
        Vous recevez ce message parce que votre famille est inscrite chez New Valkyria. Pour ne plus recevoir nos promotions, répondez simplement « STOP ».
      </div>
    </div>
  </div>`;

  const text = [
    `Bonjour ${firstName || ""},`,
    "",
    "Merci de faire partie de la famille New Valkyria. Deux nouveaux programmes de développement sont offerts :",
    ...programs.map((p) => `• ${p.shortName} — ${formatMoney(p.priceCents)} : ${p.link}`),
    "",
    `Quand une famille s'inscrit avec votre lien : ${formatMoney(discount)} de rabais pour elle, et pour vous un sac New Valkyria ou ${formatMoney(5000)} de crédit.`,
    `Votre code : ${code}`,
    `Mes recommandations : ${origin}/compte/recommandations`,
    "",
    "New Valkyria — info@newvalkyria.com"
  ].join("\n");

  return { subject, html, text };
}

/** Familles de la saison en cours : inscriptions payées (Automne/Hiver, Sport-Études,
 *  Programme Intensif / Privilège, programmes privés). Chaque famille reçoit son
 *  propre code. `includePast` ajoute toutes les familles connues (ex. Été 2026). */
export async function getCampaignAudience(options: { includePast?: boolean } = {}): Promise<CampaignRecipient[]> {
  const supabase = db();
  const families = new Map<string, string>();
  const phones = new Map<string, string>();
  const add = (email: string | null, name: string | null, phone?: string | null) => {
    const e = normalizeEmail(email);
    if (!e || !e.includes("@") || e.endsWith("@newvalkyria.temp") || e.endsWith(".test") || e.endsWith("example.test")) return;
    if (!families.has(e)) families.set(e, (name ?? "").trim());
    if (phone && !phones.has(e)) phones.set(e, phone);
  };

  const [reg, spr, se] = await Promise.all([
    supabase.from("registrations").select("parent_name, parent_email, parent_phone").eq("season_id", "automne-hiver-2026").eq("status", "paid").eq("is_trial", false),
    supabase.from("session_program_registrations").select("parent_name, parent_email, parent_phone").in("status", ["paid", "confirmed"]),
    supabase.from("sport_etudes_registrations").select("parent_first_name, parent_last_name, parent_email, parent_phone").in("status", ["paid", "confirmed"])
  ]);
  for (const r of reg.data ?? []) add(r.parent_email, r.parent_name, r.parent_phone);
  for (const r of spr.data ?? []) add(r.parent_email, r.parent_name, r.parent_phone);
  for (const r of se.data ?? []) add(r.parent_email, `${r.parent_first_name} ${r.parent_last_name}`, r.parent_phone);

  if (options.includePast) {
    const [leads, allRegs] = await Promise.all([
      supabase.from("leads").select("parent_name, email, phone").neq("status", "cancelled"),
      supabase.from("registrations").select("parent_name, parent_email, parent_phone").neq("status", "cancelled")
    ]);
    for (const r of leads.data ?? []) add(r.email, r.parent_name, r.phone);
    for (const r of allRegs.data ?? []) add(r.parent_email, r.parent_name, r.parent_phone);
  }

  // Désabonnés : ceux qui ont répondu « STOP » (liste tenue dans referral_campaign_optouts).
  const { data: optouts } = await supabase.from("referral_campaign_optouts").select("email");
  const out = new Set((optouts ?? []).map((o: any) => normalizeEmail(o.email)));

  const recipients: CampaignRecipient[] = [];
  for (const [email, name] of families) {
    if (out.has(email)) continue;
    const code = await getOrCreateReferralCode(email, name || null);
    const first = name.split(/\s+/)[0] ?? "";
    recipients.push({ email, name, firstName: first ? first.charAt(0).toUpperCase() + first.slice(1) : "", code: code.code, phone: phones.get(email) ?? null });
  }
  return recipients.sort((a, b) => a.name.localeCompare(b.name));
}

/** Texto / WhatsApp direct à UNE famille : court, personnel, avec ses liens. */
export function buildDirectMessage(firstName: string, programs: CampaignProgram[]): string {
  const discount = programs[0]?.referralDiscountCents ?? 5000;
  const lines = [
    `Bonjour${firstName ? " " + firstName : ""}, c'est New Valkyria. Merci de faire partie de la famille !`,
    `Deux nouveaux programmes de développement sont offerts. Chaque famille que vous nous référez avec votre lien obtient ${formatMoney(discount)} de rabais, et vous recevez un sac New Valkyria ou ${formatMoney(5000)} de crédit.`,
    ...programs.map((p) => `• ${p.shortName} (${formatMoney(p.priceCents)}) : ${p.link}`),
    "Il suffit de transférer ce message ou le lien à une famille qui pourrait être intéressée. Merci !"
  ];
  return lines.join("\n\n");
}

export function phoneDigits(phone: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `1${d}`;
  if (d.length === 11 && d.startsWith("1")) return d;
  return d.length >= 10 ? d : null;
}

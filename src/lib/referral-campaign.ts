import { buildShareMessage, capacityLabel, formatMoney, privateProgramUrl, shareLinks } from "@/lib/private-programs";
import { countHeldPlaces, getAllPrivatePrograms, type PrivateProgram } from "@/lib/private-programs-repo";
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
  minCapacity: number | null;
  /** Places encore disponibles (payées + réservations valides déjà déduites). */
  remaining: number;
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
  const held = await Promise.all(programs.map((p) => countHeldPlaces(p.slug)));
  return programs.map((p, i) => {
    const link = privateProgramUrl(origin, p.slug, code);
    const shortName = programShortName(p);
    const message = buildShareMessage({
      program: { slug: p.slug, shortName, priceCents: p.price_cents },
      link,
      practices: p.practices_count ?? 16,
      matches: p.matches_count ?? 3,
      capacity: p.max_capacity,
      minCapacity: p.min_capacity,
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
      minCapacity: p.min_capacity,
      remaining: Math.max(0, p.max_capacity - held[i]),
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

export type CampaignStep = 1 | 2 | 3;

export const CAMPAIGN_STEPS: { step: CampaignStep; label: string; when: string }[] = [
  { step: 1, label: "Courriel 1 — Annonce", when: "Aujourd'hui" },
  { step: 2, label: "Courriel 2 — Rappel simple", when: "Dimanche" },
  { step: 3, label: "Courriel 3 — Dernières places", when: "Mercredi" }
];

/** Identifiant d'envoi : une famille ne reçoit chaque courriel qu'une seule fois. */
export function campaignKey(step: CampaignStep): string {
  return `partage-2026-10-e${step}`;
}

const COACHES = "JP et Maeva";

/** Séquence de 3 courriels personnalisés par famille : chaque message contient
 *  le code et les liens de CETTE famille, avec des boutons de partage prêts à
 *  l'emploi (WhatsApp, courriel, SMS). */
export function buildCampaignEmail(input: { step?: CampaignStep; firstName: string; code: string; programs: CampaignProgram[]; origin: string; audience?: "current" | "former" }): { subject: string; html: string; text: string } {
  if (input.audience === "former") return buildFormerFamilyEmail(input);
  const step: CampaignStep = input.step ?? 1;
  const { firstName, code, programs, origin } = input;
  const discount = formatMoney(programs[0]?.referralDiscountCents ?? 5000);
  const credit = formatMoney(5000);
  const hello = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";
  const totalLeft = programs.reduce((n, p) => n + p.remaining, 0);

  const btn = (href: string, label: string, bg: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 18px;border-radius:8px;margin:4px 6px 4px 0">${label}</a>`;
  const p = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;

  const cards = programs
    .map(
      (g) => `
      <div style="background:#f7f4fb;border:1px solid #e3dbf0;border-radius:12px;padding:16px;margin:0 0 16px">
        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#72499a;font-weight:bold">${escapeHtml(g.shortName)}</p>
        <p style="margin:4px 0 8px;font-size:20px;font-weight:bold;color:#161419">${formatMoney(g.priceCents)}</p>
        <p style="margin:0 0 12px;font-size:14px;color:#3d3852">${g.practices} pratiques · ${g.matches} matchs inclus · ${capacityLabel(g.minCapacity, g.capacity)} joueurs${step === 3 ? ` · <strong style="color:#b4380f">${g.remaining > 0 ? `il reste ${g.remaining} place${g.remaining > 1 ? "s" : ""}` : "complet — liste d'attente"}</strong>` : ""}</p>
        <div>
          ${btn(g.whatsapp, "Partager sur WhatsApp", "#1f9d55")}
          ${btn(g.email, "Envoyer par courriel", "#72499a")}
          ${btn(g.sms, "Envoyer par SMS", "#3d3852")}
        </div>
        <p style="margin:10px 0 0;font-size:12px;color:#6d6880">Votre lien personnel :<br/><a href="${escapeHtml(g.link)}" style="color:#72499a;word-break:break-all">${escapeHtml(g.link)}</a></p>
      </div>`
    )
    .join("");

  // Récompenses mises en évidence : 50 $ de rabais pour eux + sac (ou crédit) pour vous.
  const rewardsHighlight = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin:0 0 18px">
      <tr>
        <td width="50%" valign="top" style="padding-right:6px">
          <div style="background:#72499a;color:#ffffff;border-radius:14px;padding:30px 14px;text-align:center;height:100%">
            <p style="margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#e3d3f5;font-weight:bold">Pour eux</p>
            <p style="margin:6px 0 0;font-size:44px;line-height:1;font-weight:bold">${escapeHtml(discount.replace(/,00/, ""))}</p>
            <p style="margin:6px 0 0;font-size:16px;font-weight:bold">DE RABAIS</p>
            <p style="margin:8px 0 0;font-size:13px;line-height:1.4;color:#efe6fa">sur l'inscription de chaque famille que vous référez</p>
          </div>
        </td>
        <td width="50%" valign="top" style="padding-left:6px">
          <div style="background:#f7f4fb;border:2px solid #72499a;border-radius:14px;padding:12px 10px;text-align:center;height:100%">
            <p style="margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#72499a;font-weight:bold">Pour vous</p>
            <img src="${origin}/og/sac-nv.jpg" width="120" height="120" alt="Sac à dos New Valkyria" style="display:block;margin:6px auto;width:120px;height:120px;border:0;border-radius:8px" />
            <p style="margin:0;font-size:15px;font-weight:bold;color:#2a1a45">Un sac à dos New Valkyria</p>
            <p style="margin:4px 0 0;font-size:12px;color:#3d3852">ou ${escapeHtml(credit.replace(/,00/, ""))} de crédit pour la prochaine saison — à votre choix</p>
          </div>
        </td>
      </tr>
    </table>`;
  const rewardBox = `
    ${rewardsHighlight}
    <div style="background:#2a1a45;color:#ffffff;border-radius:12px;padding:14px 18px;margin:0 0 18px">
      <p style="margin:0 0 6px;font-weight:bold;font-size:15px">Comment ça fonctionne</p>
      <p style="margin:0;font-size:14px;line-height:1.6">
        1. Envoyez votre lien personnel à une famille.<br/>
        2. Elle s'inscrit et profite du rabais.<br/>
        3. Vous choisissez votre récompense : le sac ou le crédit.
      </p>
    </div>`;

  let subject = "";
  let intro = "";
  let outro = "";
  const textIntro: string[] = [];

  if (step === 1) {
    subject = "Nouveau programme pour garçons : 50 $ de rabais pour eux, un sac pour vous";
    intro =
      `<p style="margin:0 0 16px"><span style="display:inline-block;background:#72499a;color:#ffffff;font-size:12px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;border-radius:999px">Nouveau programme pour garçons</span></p>` +
      p(hello) +
      p("Nous lançons un <strong>nouveau programme de développement pour garçons</strong> (2018 et 2014–2015), encadré par <strong>JP et Maeva</strong>, nos meilleurs entraîneurs.") +
      p("Chaque inscription nous permet de <strong>financer davantage de projets gratuits pour les filles de l'académie</strong>.") +
      p("<strong>Une famille en tête ? Envoyez-lui votre lien :</strong>");
    outro = p("Merci de nous aider à faire grandir l'académie, au bénéfice de toutes nos filles.");
    textIntro.push("NOUVEAU PROGRAMME POUR GARÇONS (2018 et 2014–2015), encadré par JP et Maeva, nos meilleurs entraîneurs.", "Chaque inscription nous permet de financer davantage de projets gratuits pour les filles de l'académie.");
  } else if (step === 2) {
    subject = "Un seul message suffit : partagez le programme à une famille";
    intro =
      p(hello) +
      p("Un petit rappel — et c'est vraiment simple : <strong>un seul message</strong> à une famille qui a un garçon de 2018 ou de 2014–2015.") +
      p(`Pour vous faciliter la tâche, tout est prêt ci-dessous : touchez un bouton, le message et votre lien personnel s'ouvrent. Chaque inscription aide à financer des projets gratuits pour les filles de l'académie.`);
    outro = p("Merci d'en parler autour de vous — votre appui fait une vraie différence.");
    textIntro.push("Un seul message suffit : partagez votre lien à une famille qui a un garçon de 2018 ou 2014–2015.");
  } else {
    // « Dernières places » seulement quand c'est vrai (jamais d'urgence inventée).
    const low = totalLeft > 0 && totalLeft <= 8;
    subject = totalLeft === 0
      ? "Programmes garçons : liste d'attente ouverte"
      : low
        ? `Dernières places : il reste ${totalLeft} place${totalLeft > 1 ? "s" : ""} dans les programmes garçons`
        : `Il reste des places dans les programmes garçons — merci de partager`;
    intro =
      p(hello) +
      p(totalLeft === 0
        ? "Nos deux programmes pour garçons sont maintenant complets, mais une liste d'attente est ouverte."
        : low
          ? `Dernier rappel : <strong>il reste ${totalLeft} place${totalLeft > 1 ? "s" : ""}</strong> dans nos deux programmes pour garçons, et les groupes sont limités.`
          : `Dernier rappel : les inscriptions aux deux programmes pour garçons sont ouvertes et <strong>il reste ${totalLeft} places</strong> — les groupes sont limités à ${capacityLabel(programs[0]?.minCapacity ?? null, programs[0]?.capacity ?? 14)} joueurs.`) +
      p(`Si une famille de votre entourage hésite, c'est le bon moment pour lui envoyer votre lien. Le programme est encadré par ${COACHES}, et chaque inscription finance des projets gratuits pour les filles de l'académie.`);
    outro = p("Merci d'avoir contribué à faire connaître New Valkyria — c'est grâce à vous que l'académie grandit.");
    textIntro.push(totalLeft > 0 ? `Dernier rappel : il reste ${totalLeft} place(s) dans les programmes garçons.` : "Les programmes garçons sont complets : liste d'attente ouverte.");
  }

  const html = `
  <div style="background:#efeaf5;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden">
      <div style="background:#2a1a45;padding:22px 24px;text-align:center">
        <img src="${origin}/og/logo-courriel.png" width="130" height="130" alt="New Valkyria" style="display:block;margin:0 auto 10px;width:130px;height:130px;border:0" />
        <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:.06em">NEW VALKYRIA</p>
        <p style="margin:2px 0 0;color:#c8aae0;font-size:13px">Académie technique de soccer</p>
      </div>
      <div style="padding:24px;color:#161419;font-size:15px;line-height:1.55">
        ${intro}
        ${step !== 2 ? rewardBox : rewardsHighlight}
        <p style="margin:0 0 10px;font-weight:bold">Touchez un bouton — le message est déjà écrit :</p>
        ${cards}

        <p style="margin:0 0 6px;font-size:14px">Votre code : <strong style="letter-spacing:.1em;color:#72499a">${escapeHtml(code)}</strong> (déjà inclus dans vos liens).</p>
        <p style="margin:0 0 18px;font-size:14px">Suivez vos recommandations et choisissez votre récompense : <a href="${origin}/compte/recommandations" style="color:#72499a;font-weight:bold">Mes recommandations</a></p>
        ${step === 1 ? `
        <div style="background:#f7f4fb;border-left:4px solid #72499a;border-radius:6px;padding:14px 16px;margin:0 0 18px">
          <p style="margin:0 0 6px;font-weight:bold;color:#2a1a45">Notre engagement</p>
          <p style="margin:0;font-size:14px;line-height:1.55;color:#3d3852"><strong>New Valkyria restera toujours une académie 100 % féminine.</strong> Ces projets éclair nous permettent d'offrir un excellent service à plus de jeunes et d'offrir davantage d'opportunités aux filles de l'académie.</p>
        </div>` : ""}
        ${outro}
        <p style="margin:0;font-size:14px">L'équipe New Valkyria<br/>info@newvalkyria.com</p>
      </div>
      <div style="background:#f7f4fb;padding:12px 24px;font-size:11px;color:#6d6880">
        Vous recevez ce message parce que votre famille est inscrite chez New Valkyria. Pour ne plus recevoir nos messages de partage, répondez simplement « STOP ».
      </div>
    </div>
  </div>`;

  const text = [
    firstName ? `Bonjour ${firstName},` : "Bonjour,",
    "",
    ...textIntro,
    "",
    ...programs.map((g) => `• ${g.shortName} — ${formatMoney(g.priceCents)} : ${g.link}`),
    "",
    ...(step === 1 ? ["Notre engagement : New Valkyria restera toujours une académie 100 % féminine. Ces projets éclair nous permettent d'offrir un excellent service à plus de jeunes et d'offrir davantage d'opportunités aux filles de l'académie.", ""] : []),
    `Pour eux : ${discount} de rabais. Pour vous : un sac New Valkyria ou ${credit} de crédit.`,
    `Votre code : ${code}`,
    `Mes recommandations : ${origin}/compte/recommandations`,
    "",
    "L'équipe New Valkyria — info@newvalkyria.com"
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

/** Anciennes familles : connues du système (Été 2026, essais, inscriptions passées)
 *  mais sans inscription payée en cours — et sans offre en attente (inscription
 *  « en attente » ou liste d'attente), pour ne pas les confondre. Les familles
 *  ayant payé un essai en font partie. */
export async function getFormerFamiliesAudience(): Promise<CampaignRecipient[]> {
  const [all, current] = await Promise.all([getCampaignAudience({ includePast: true }), getCampaignAudience()]);
  const currentSet = new Set(current.map((r) => r.email));
  const supabase = db();
  const { data: active } = await supabase.from("registrations").select("parent_email").eq("season_id", "automne-hiver-2026").in("status", ["pending", "waitlist"]);
  const busy = new Set((active ?? []).map((r: any) => normalizeEmail(r.parent_email)));
  return all.filter((r) => !currentSet.has(r.email) && !busy.has(r.email));
}

/** Courriel pour les anciennes familles : un seul message, uniquement le rabais
 *  pour la famille référée (aucune récompense de sac ni de crédit promise). */
function buildFormerFamilyEmail(input: { firstName: string; code: string; programs: CampaignProgram[]; origin: string }): { subject: string; html: string; text: string } {
  const { firstName, code, programs, origin } = input;
  const discount = formatMoney(programs[0]?.referralDiscountCents ?? 5000);
  const discountShort = discount.replace(/,00/, "");
  const btn = (href: string, label: string, bg: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 18px;border-radius:8px;margin:4px 6px 4px 0">${label}</a>`;
  const p = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;

  const cards = programs
    .map(
      (g) => `
      <div style="background:#f7f4fb;border:1px solid #e3dbf0;border-radius:12px;padding:16px;margin:0 0 16px">
        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#72499a;font-weight:bold">${escapeHtml(g.shortName)}</p>
        <p style="margin:4px 0 8px;font-size:20px;font-weight:bold;color:#161419">${formatMoney(g.priceCents)}</p>
        <p style="margin:0 0 12px;font-size:14px;color:#3d3852">${g.practices} pratiques · ${g.matches} matchs inclus · ${capacityLabel(g.minCapacity, g.capacity)} joueurs</p>
        <div>
          ${btn(g.whatsapp, "Partager sur WhatsApp", "#1f9d55")}
          ${btn(g.email, "Envoyer par courriel", "#72499a")}
          ${btn(g.sms, "Envoyer par SMS", "#3d3852")}
        </div>
        <p style="margin:10px 0 0;font-size:12px;color:#6d6880">Votre lien personnel :<br/><a href="${escapeHtml(g.link)}" style="color:#72499a;word-break:break-all">${escapeHtml(g.link)}</a></p>
      </div>`
    )
    .join("");

  const html = `
  <div style="background:#efeaf5;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden">
      <div style="background:#2a1a45;padding:22px 24px;text-align:center">
        <img src="${origin}/og/logo-courriel.png" width="130" height="130" alt="New Valkyria" style="display:block;margin:0 auto 10px;width:130px;height:130px;border:0" />
        <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:.06em">NEW VALKYRIA</p>
        <p style="margin:2px 0 0;color:#c8aae0;font-size:13px">Académie technique de soccer</p>
      </div>
      <div style="padding:24px;color:#161419;font-size:15px;line-height:1.55">
        <p style="margin:0 0 16px"><span style="display:inline-block;background:#72499a;color:#ffffff;font-size:12px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;padding:6px 12px;border-radius:999px">Nouveau programme pour garçons</span></p>
        ${p(`Bonjour${firstName ? " " + escapeHtml(firstName) : ""},`)}
        ${p("Merci d'avoir fait un bout de chemin avec New Valkyria. Nous lançons un <strong>nouveau programme de développement pour garçons</strong> (2018 et 2014–2015), encadré par <strong>JP et Maeva</strong>, nos meilleurs entraîneurs.")}
        ${p("Chaque inscription nous permet de <strong>financer davantage de projets gratuits pour les filles de l'académie</strong>.")}
        ${p("<strong>Une famille en tête ? Envoyez-lui votre lien :</strong>")}
        <div style="background:#72499a;color:#ffffff;border-radius:14px;padding:22px 16px;text-align:center;margin:0 0 18px">
          <p style="margin:0;font-size:44px;line-height:1;font-weight:bold">${escapeHtml(discountShort)}</p>
          <p style="margin:6px 0 0;font-size:16px;font-weight:bold">DE RABAIS</p>
          <p style="margin:8px 0 0;font-size:13px;line-height:1.4;color:#efe6fa">pour la famille qui s'inscrit avec votre lien</p>
        </div>
        <p style="margin:0 0 10px;font-weight:bold">Touchez un bouton — le message est déjà écrit :</p>
        ${cards}
        <p style="margin:0 0 18px;font-size:14px">Votre code : <strong style="letter-spacing:.1em;color:#72499a">${escapeHtml(code)}</strong> (déjà inclus dans vos liens).</p>
        <div style="background:#f7f4fb;border-left:4px solid #72499a;border-radius:6px;padding:14px 16px;margin:0 0 18px">
          <p style="margin:0 0 6px;font-weight:bold;color:#2a1a45">Notre engagement</p>
          <p style="margin:0;font-size:14px;line-height:1.55;color:#3d3852"><strong>New Valkyria restera toujours une académie 100 % féminine.</strong> Ces projets éclair nous permettent d'offrir un excellent service à plus de jeunes et d'offrir davantage d'opportunités aux filles de l'académie.</p>
        </div>
        ${p("Merci de faire connaître New Valkyria autour de vous.")}
        <p style="margin:0;font-size:14px">L'équipe New Valkyria<br/>info@newvalkyria.com</p>
      </div>
      <div style="background:#f7f4fb;padding:12px 24px;font-size:11px;color:#6d6880">
        Vous recevez ce message parce que votre famille a déjà participé à une activité New Valkyria. Pour ne plus recevoir nos messages, répondez simplement « STOP ».
      </div>
    </div>
  </div>`;

  const text = [
    `Bonjour${firstName ? " " + firstName : ""},`,
    "",
    "NOUVEAU PROGRAMME POUR GARÇONS (2018 et 2014–2015), encadré par JP et Maeva, nos meilleurs entraîneurs.",
    "Chaque inscription nous permet de financer davantage de projets gratuits pour les filles de l'académie.",
    "",
    ...programs.map((g) => `• ${g.shortName} — ${formatMoney(g.priceCents)} : ${g.link}`),
    "",
    `${discount} de rabais pour la famille qui s'inscrit avec votre lien. Votre code : ${code}`,
    "",
    "Notre engagement : New Valkyria restera toujours une académie 100 % féminine. Ces projets éclair nous permettent d'offrir un excellent service à plus de jeunes et d'offrir davantage d'opportunités aux filles de l'académie.",
    "",
    "L'équipe New Valkyria — info@newvalkyria.com"
  ].join("\n");

  return { subject: `Nouveau programme pour garçons : ${discount} de rabais avec votre lien`, html, text };
}

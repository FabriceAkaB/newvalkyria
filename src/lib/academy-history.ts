import { computeRevenueSummary } from "@/lib/revenue-calc";
import { PROGRAMS, type ProgramCode } from "@/lib/season-2027";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** « Historique de l'académie » : tout ce qu'il faut savoir sur New Valkyria.
 *  Le récit (NARRATIVE) est rédigé à la main ; tous les chiffres sont recalculés
 *  à partir de la base à chaque ouverture de la page, donc toujours à jour. */

export const NARRATIVE_REVISED_ON = "2026-10-24";

export const NARRATIVE: { title: string; paragraphs: string[] }[] = [
  {
    title: "Qui nous sommes",
    paragraphs: [
      "New Valkyria est une académie de soccer technique des Laurentides, fondée et dirigée par Jean-Paul Aka Boidi (JP), entraîneur certifié. L'académie est d'abord née pour les filles : développer la technique individuelle (première touche, passe, conduite, prise de décision) dans des groupes en semi-privé, en complément du soccer de club.",
      "L'équipe de direction : JP (fondateur, entraîneur-chef, développement), Annie Tremblay (responsable administratif : paies, suivi des paiements, courriels aux familles) et Christine Durand (gérante, suivi des commandites et des familles). Les entraîneuses et entraîneurs adjoints sont engagés à contrat saisonnier, à l'heure.",
      "Lieux d'entraînement : gymnases de Sainte-Thérèse (lundi, mercredi), École des Falaises à Prévost (jeudi), École de la Voltige à Sainte-Thérèse et École Chambéry à Blainville (programmes garçons), terrain n° 4 du Complexe sportif de Terrebonne (pratiques et matchs du dimanche) et un local au 99, rue Émilien-Marcoux, Blainville (Privilège Valkyria)."
    ]
  },
  {
    title: "Comment l'académie s'est construite",
    paragraphs: [
      "Printemps–été 2026 : première saison (Été 2026). Les inscriptions en ligne débutent le 5 avril 2026, surtout par le bouche-à-oreille des clubs de la région (FC Boréal, FC Révolution, Les Satellites de Sainte-Anne-des-Plaines, AS Blainville) et le réseau de la gérante.",
      "Août 2026 : lancement de la saison Automne/Hiver 2026 avec une gamme de programmes (New Valkyria, Team Valkyria, Team Valkyria Avancé, Solo Valkyria et Solo Avancé), paiement en une fois ou en versements prélevés automatiquement, évaluations des joueuses et groupes avancés. Ouverture du programme Sport-Études et de la boutique (sacs, uniformes).",
      "Septembre–octobre 2026 : demi-saison sur invitation (pour embarquer en cours de route), programme Privilège Valkyria, essais gratuits et conversion des essais en inscriptions, campagne de références entre familles.",
      "Octobre 2026 : expansion vers les garçons (Programme intensif garçons 2015, Programme intensif spécial garçons 2014, essais gratuits garçons 2018), vente de plages de matchs à d'autres clubs et académies (150 $ la plage : acompte de 50 $ + solde de 100 $), programme de commandites 2027 (13 emplacements) et premières offres de partenariat (Alowa Apparel, Action Sport Physio), contrats d'embauche signés en ligne pour le personnel."
    ]
  },
  {
    title: "Notre modèle",
    paragraphs: [
      "Revenus : surtout les inscriptions des familles (programmes de saison, demi-saison, Sport-Études, programmes garçons), complétés par la boutique, les séances privées, la vente de plages de matchs, la location de terrain et les commandites.",
      "Coûts principaux : la paie des entraîneurs (à l'heure, payée aux deux semaines par dépôt direct), la location des gymnases et terrains, les uniformes et l'équipement, et les frais de paiement Stripe.",
      "Promesses aux familles : groupes limités en semi-privé, suivi individuel (bulletin, notes, programme vidéo maison), communication directe par courriel, garantie satisfait ou remboursé sur les offres d'inscription."
    ]
  },
  {
    title: "Enjeux à garder en tête",
    paragraphs: [
      "Trésorerie : en octobre 2026, le solde Stripe est devenu négatif à cause des remboursements ; il a fallu ajouter des fonds depuis BMO. Garder une réserve dans Stripe avant d'émettre des remboursements.",
      "Conversion et rétention : plusieurs familles commencent une inscription sans la terminer, et certaines joueuses de l'été ne sont pas encore réinscrites. Les relances personnelles (offres 2 pour 1, demi-saison) donnent de bons résultats.",
      "Capacité : les groupes avancés (lundi 18 h, mercredi 19 h 30) sont pleins ; ouvrir des places demande des gymnases et des entraîneurs supplémentaires.",
      "Personnel : recruter et retenir des entraîneurs qualifiés (vérification des antécédents, formations en sport sécuritaire, contrats signés, paie exacte).",
      "Uniformes : une erreur de commande à l'automne 2026 ; distribution à partir du 26 octobre et nouveaux uniformes aux couleurs des commanditaires après les Fêtes.",
      "Administration : mandat comptable (états financiers, T2/CO-17, QuickBooks) avec Pontbriand Lamarche CPA ; inscription aux fichiers de la TPS et de la TVQ à faire ; demande de remboursement en cours auprès d'Ultra (ELAB Consulting) pour un accompagnement non suivi (1 000 €).",
      "Expansion garçons : réussir les premières cohortes (2014, 2015, 2018) sans diluer la qualité du programme filles."
    ]
  }
];

function db() {
  return getSupabaseAdminClient() as any;
}

async function rows<T = any>(query: PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  try {
    const { data } = await query;
    return data ?? [];
  } catch {
    return [];
  }
}

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function cityKey(raw: string) {
  return stripAccents(raw.trim().toLowerCase())
    .replace(/^st[\s.-]+/, "saint-")
    .replace(/^ste[\s.-]+/, "sainte-")
    .replace(/[\s]+/g, "-");
}

function clubLabel(raw: string): string {
  const k = stripAccents(raw.toLowerCase());
  if (/boreal/.test(k)) return "FC Boréal";
  if (/revolution|revo\b/.test(k)) return "FC Révolution";
  if (/satel|s\.?a\.?d\.?p|anne des plaines/.test(k)) return "Les Satellites (Sainte-Anne-des-Plaines)";
  if (/csrdp/.test(k)) return "CSRDP";
  if (/\basb\b|blainville/.test(k)) return "AS Blainville";
  if (/aucun|^non|debutant/.test(k)) return "Aucun club / débutante";
  if (/\buls\b/.test(k)) return "ULS";
  // Retire la catégorie et la division (U10, D1, P2…) pour regrouper un même club.
  const name = raw.replace(/\b(u\d{1,2}|[dpsf]{1,2}\d(-\d)?|\d{2}f)\b/gi, "").replace(/[-·,]+\s*$/g, "").replace(/\s+/g, " ").trim();
  return name ? titleCase(name) : "";
}

function sourceLabel(raw: string | null): string {
  if (!raw) return "Non précisé";
  const k = stripAccents(raw.toLowerCase());
  if (/christine|gerante/.test(k)) return "Christine Durand (gérante)";
  if (/\bjp\b|jean.?paul/.test(k)) return "JP";
  if (/insta|istagram|facebook|\bfb\b/.test(k)) return "Réseaux sociaux";
  if (/non specifie/.test(k)) return "Non précisé";
  return "Un autre parent / entraîneur";
}

/** Préfère la forme la plus soignée d'un libellé (accents, majuscule, « Saint » au long). */
function labelScore(label: string): number {
  let score = 0;
  if (stripAccents(label) !== label) score += 2;
  if (/^[A-ZÀ-Ý]/.test(label)) score += 1;
  if (/\bSainte?\b/.test(label)) score += 2;
  if (/-/.test(label)) score += 1;
  return score;
}

function titleCase(s: string): string {
  return s.replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export interface Count {
  label: string;
  count: number;
}

function tally(values: string[], keyFn: (v: string) => string = (v) => v, labelFn?: (v: string) => string): Count[] {
  const map = new Map<string, { count: number; labels: Map<string, number> }>();
  for (const v of values) {
    if (!v || !v.trim()) continue;
    const key = keyFn(v);
    const entry = map.get(key) ?? { count: 0, labels: new Map() };
    entry.count += 1;
    const label = labelFn ? labelFn(v) : v.trim();
    entry.labels.set(label, (entry.labels.get(label) ?? 0) + 1);
    map.set(key, entry);
  }
  return [...map.values()]
    .map((e) => ({
      // Libellé le plus fréquent, en privilégiant la forme accentuée.
      label: [...e.labels.entries()].sort((a, b) => labelScore(b[0]) - labelScore(a[0]) || b[1] - a[1])[0][0],
      count: e.count
    }))
    .sort((a, b) => b.count - a.count);
}

export interface ProgramLine {
  name: string;
  audience: string;
  priceCents: number | null;
  priceNote?: string;
  enrolled: number;
  capacity?: number | null;
}

export interface TimelineItem {
  date: string;
  text: string;
}

export interface AcademySnapshot {
  generatedAt: string;
  keyFigures: { label: string; value: string; hint?: string }[];
  programs: { girls: ProgramLine[]; boys: ProgramLine[]; other: ProgramLine[] };
  clientele: {
    girlsByYear: Count[];
    boysByYear: Count[];
    cities: Count[];
    clubs: Count[];
    sources: Count[];
    siblingFamilies: number;
    families: number;
  };
  revenue: { seasons: { label: string; totalCents: number; expenseCents: number; profitCents: number; goalCents: number }[]; months: { month: string; revenueCents: number; expenseCents: number }[]; grandTotalCents: number; grandExpenseCents: number } | null;
  team: { name: string; role: string; status: string; contract?: string }[];
  partners: { name: string; status: string; detail: string }[];
  groups: { label: string; taken: number; max: number }[];
  issues: { level: "rouge" | "orange" | "info"; text: string }[];
  timeline: TimelineItem[];
}

const money = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const day = (iso: string) => iso.slice(0, 10);

export async function buildAcademySnapshot(): Promise<AcademySnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const [
    seasons,
    regs,
    programsDb,
    sessionPrograms,
    sessionRegs,
    sportEtudes,
    boysTrials,
    leads,
    slots,
    slotPrograms,
    coaches,
    contracts,
    sponsors,
    sponsorSlots,
    offers,
    matchSlots,
    matchBookings,
    shopOrders,
    installments,
    specialOffers,
    audit,
    children
  ] = await Promise.all([
    rows(db().from("seasons").select("*")),
    rows(db().from("registrations").select("id, season_id, program_id, category_id, status, is_trial, city, parent_email, time_slot_template_id, created_at, updated_at, player_first_name")),
    rows(db().from("programs").select("id, season_id, name, price_cents, active")),
    rows(db().from("session_programs").select("slug, name, price_cents, gender, is_private, active, max_capacity, created_at")),
    rows(db().from("session_program_registrations").select("program_slug, status, city, birth_year, player_dob, parent_email, created_at")),
    rows(db().from("sport_etudes_registrations").select("status, player_birth_year, player_dob, current_club, parent_email, price_cents, created_at")),
    rows(db().from("boys_trials").select("program_slug, status, birth_year, trial_date, created_at")),
    rows(db().from("leads").select("status, goal, city, email, player_age, created_at")),
    rows(db().from("time_slot_templates").select("id, day, start_time, location, max_places, active")),
    rows(db().from("time_slot_template_programs").select("time_slot_template_id, program_id")),
    rows(db().from("coaches").select("first_name, last_name, role, status, hired_on")),
    rows(db().from("employee_contracts").select("employee_name, title, status, signed_at, created_at")),
    rows(db().from("sponsors").select("company_name, status, partnership_type, proposed_amount_cents, created_at")),
    rows(db().from("sponsor_slots_2027").select("tier_label, placement, price_cents, status")),
    rows(db().from("partnership_offers").select("company_name, status, respond_by, sent_at")),
    rows(db().from("match_slots").select("id, created_at")),
    rows(db().from("match_slot_bookings").select("status, price_cents, balance_due_cents, created_at")),
    rows(db().from("shop_orders").select("status, total_cents, created_at")),
    rows(db().from("registration_payment_plan_installments").select("status, due_date, amount_cents")),
    rows(db().from("special_offers").select("title, parent_name, expires_at, paid_at")),
    rows(
      db()
        .from("audit_log")
        .select("action, entity_label, actor_label, created_at")
        .in("action", ["full_refund", "partial_refund", "trial_converted", "season_completion", "special_offer_paid"])
        .order("created_at", { ascending: false })
        .limit(40)
    ),
    rows(db().from("children").select("club"))
  ]);

  const activeSeason = seasons.find((s: any) => s.is_active)?.id ?? "automne-hiver-2026";
  const paidGirls = regs.filter((r: any) => r.season_id === activeSeason && r.status === "paid");
  const paidBoysPrograms = sessionRegs.filter((r: any) => r.status === "paid");
  const boysSlugs = new Set(sessionPrograms.filter((p: any) => p.gender === "garcons").map((p: any) => p.slug));
  const paidBoys = paidBoysPrograms.filter((r: any) => boysSlugs.has(r.program_slug));
  const sportEtudesActive = sportEtudes.filter((r: any) => r.status === "paid" || r.status === "confirmed");
  const summerPaid = leads.filter((l: any) => l.status === "paid");

  // ── Revenus (même calcul que la section Revenus) ──
  let revenue: AcademySnapshot["revenue"] = null;
  try {
    const summary = await computeRevenueSummary();
    revenue = {
      seasons: summary.seasons.map((s) => ({ label: s.label, totalCents: s.totalCents, expenseCents: s.expenseCents, profitCents: s.profitCents, goalCents: s.goalCents })),
      months: summary.months.map((m) => ({ month: m.month, revenueCents: m.revenueCents, expenseCents: m.expenseCents })),
      grandTotalCents: summary.grandTotalCents,
      grandExpenseCents: summary.grandExpenseCents
    };
  } catch {
    revenue = null;
  }

  // ── Familles ──
  const familyChildren = new Map<string, number>();
  for (const r of [...paidGirls, ...paidBoys, ...sportEtudesActive]) {
    const e = String(r.parent_email ?? "").trim().toLowerCase();
    if (e) familyChildren.set(e, (familyChildren.get(e) ?? 0) + 1);
  }

  // ── Chiffres clés ──
  const paidKeys = new Set(regs.filter((r: any) => r.status === "paid").map((r: any) => `${String(r.parent_email).toLowerCase()}|${stripAccents(String(r.player_first_name ?? "").trim().toLowerCase())}`));
  const pendingKeys = new Set<string>();
  const pending = regs.filter((r: any) => {
    if (r.season_id !== activeSeason || r.status !== "pending" || r.is_trial) return false;
    const key = `${String(r.parent_email).toLowerCase()}|${stripAccents(String(r.player_first_name ?? "").trim().toLowerCase())}`;
    if (paidKeys.has(key) || pendingKeys.has(key)) return false;
    pendingKeys.add(key);
    return true;
  });
  const keyFigures: AcademySnapshot["keyFigures"] = [
    { label: "Joueuses inscrites (saison en cours)", value: String(paidGirls.length) },
    { label: "Garçons inscrits (programmes garçons)", value: String(paidBoys.length) },
    { label: "Sport-Études", value: String(sportEtudesActive.length) },
    { label: "Familles actives", value: String(familyChildren.size), hint: `${[...familyChildren.values()].filter((n) => n > 1).length} avec plus d'un enfant` },
    { label: "Joueuses de l'été 2026", value: String(summerPaid.length) },
    { label: "Inscriptions commencées ou invitations non payées", value: String(pending.length) }
  ];
  if (revenue) {
    keyFigures.push({ label: "Revenus encaissés (toutes saisons)", value: money(revenue.grandTotalCents) });
    keyFigures.push({ label: "Dépenses enregistrées", value: money(revenue.grandExpenseCents) });
  }

  // ── Programmes et prix ──
  const girlsPrograms: ProgramLine[] = programsDb
    .filter((p: any) => p.season_id === activeSeason)
    .map((p: any) => ({
      name: `${p.name} (${p.id})`,
      audience: PROGRAMS[p.id as ProgramCode]?.tagline ?? "Filles",
      priceCents: p.price_cents,
      enrolled: paidGirls.filter((r: any) => r.program_id === p.id).length
    }))
    .sort((a: ProgramLine, b: ProgramLine) => b.enrolled - a.enrolled);
  const boysPrograms: ProgramLine[] = sessionPrograms
    .filter((p: any) => p.gender === "garcons" && !/retir/i.test(p.name))
    .map((p: any) => ({
      name: p.name,
      audience: p.gender === "garcons" ? "Garçons" : "Filles",
      priceCents: p.price_cents,
      enrolled: paidBoysPrograms.filter((r: any) => r.program_slug === p.slug).length,
      capacity: p.max_capacity
    }));
  const other: ProgramLine[] = [
    { name: "Sport-Études", audience: "Élèves-athlètes", priceCents: sportEtudes.find((r: any) => r.price_cents)?.price_cents ?? null, enrolled: sportEtudesActive.length },
    { name: "Plage de match vendue à un autre club", audience: "Clubs et académies", priceCents: 15000, priceNote: "acompte 50 $ + solde 100 $", enrolled: matchBookings.filter((b: any) => b.status === "paid" || b.status === "confirmed").length },
    { name: "Commandites 2027", audience: "Entreprises", priceCents: null, priceNote: `${sponsorSlots.filter((s: any) => s.status === "sold").length} vendues sur ${sponsorSlots.length} emplacements`, enrolled: sponsorSlots.filter((s: any) => s.status === "sold").length },
    { name: "Boutique (sacs, équipement)", audience: "Familles", priceCents: null, priceNote: `${shopOrders.filter((o: any) => o.status !== "pending").length} commandes`, enrolled: shopOrders.filter((o: any) => o.status !== "pending").length }
  ];

  // ── Clientèle ──
  const leadClubs = leads.map((l: any) => String(l.goal ?? "").match(/Club:\s*([^·]+)/)?.[1]?.trim() ?? "").filter(Boolean);
  const clubs = tally(
    [...leadClubs, ...sportEtudes.map((r: any) => r.current_club ?? ""), ...children.map((c: any) => c.club ?? "")].filter((v) => /[a-zà-ÿ]{3}/i.test(clubLabel(v))),
    (v) => stripAccents(clubLabel(v).toLowerCase()),
    (v) => clubLabel(v)
  );
  const cities = tally(
    [...paidGirls.map((r: any) => r.city ?? ""), ...paidBoys.map((r: any) => r.city ?? "")].filter((c) => c && !/non sp/i.test(c)),
    cityKey,
    (v) => v.trim()
  );
  const sources = tally(summerPaid.map((l: any) => String(l.goal ?? "").match(/Recommandé par:\s*([^·]+)/)?.[1]?.trim() ?? ""), (v) => sourceLabel(v), (v) => sourceLabel(v));
  const noSource = summerPaid.length - sources.reduce((s, c) => s + c.count, 0);
  if (noSource > 0) sources.push({ label: "Non précisé", count: noSource });
  const mergedSources = tally(sources.flatMap((s) => Array(s.count).fill(s.label)));

  // ── Groupes (plages) ──
  const slotProgramMap = new Map<string, string[]>();
  for (const sp of slotPrograms) slotProgramMap.set(sp.time_slot_template_id, [...(slotProgramMap.get(sp.time_slot_template_id) ?? []), sp.program_id]);
  const groups = slots
    .filter((s: any) => s.active)
    .map((s: any) => {
      const inSlot = paidGirls.filter((r: any) => r.time_slot_template_id === s.id);
      const mainYear = tally(inSlot.map((r: any) => String(r.category_id ?? "")))[0]?.label;
      return {
        label: `${s.day} ${String(s.start_time).slice(0, 5)} · ${s.location}${mainYear ? ` (surtout ${mainYear})` : ""}`,
        taken: inSlot.length,
        max: s.max_places
      };
    })
    .sort((a: any, b: any) => b.taken / b.max - a.taken / a.max);

  // ── Équipe ──
  const team: AcademySnapshot["team"] = [
    { name: "Jean-Paul Aka Boidi (JP)", role: "Fondateur, entraîneur-chef certifié", status: "Direction" },
    { name: "Annie Tremblay", role: "Responsable administratif (paies, paiements, familles)", status: "Direction" },
    { name: "Christine Durand", role: "Gérante (familles, commandites)", status: "Direction" },
    ...coaches.map((c: any) => ({
      name: titleCase(`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()),
      role: c.role ?? "Entraîneur",
      status: c.status === "active" ? "Actif" : c.status,
      contract: contracts.find((k: any) => stripAccents(k.employee_name.toLowerCase()).includes(stripAccents(String(c.first_name ?? "").toLowerCase())))?.status
    })),
    ...contracts
      .filter((k: any) => !coaches.some((c: any) => stripAccents(k.employee_name.toLowerCase()).includes(stripAccents(String(c.first_name ?? "").toLowerCase()))))
      .map((k: any) => ({ name: k.employee_name, role: k.title, status: "Contrat", contract: k.status }))
  ];

  // ── Partenaires ──
  const partners: AcademySnapshot["partners"] = [
    ...sponsors.map((s: any) => ({
      name: s.company_name,
      status: s.status === "paye" ? "Payé" : s.status === "negociation" ? "En négociation" : s.status,
      detail: [s.partnership_type, s.proposed_amount_cents ? money(s.proposed_amount_cents) : null].filter(Boolean).join(" · ")
    })),
    ...offers
      .filter((o: any) => !sponsors.some((s: any) => s.company_name === o.company_name))
      .map((o: any) => ({ name: o.company_name, status: o.status === "accepted" ? "Acceptée" : "Offre envoyée", detail: o.respond_by ? `réponse attendue le ${day(o.respond_by)}` : "" }))
  ];

  // ── Enjeux détectés automatiquement ──
  const issues: AcademySnapshot["issues"] = [];
  const full = groups.filter((g) => g.max > 0 && g.taken >= g.max);
  if (full.length) issues.push({ level: "orange", text: `${full.length} groupe(s) plein(s) : ${full.map((g) => g.label).join(" ; ")}.` });
  if (pending.length) issues.push({ level: "orange", text: `${pending.length} joueuse(s) avec une inscription commencée ou une invitation (demi-saison) non payée pour la saison en cours : à relancer.` });
  const overdue = installments.filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.due_date && i.due_date < today);
  if (overdue.length) issues.push({ level: "rouge", text: `${overdue.length} versement(s) en retard (${money(overdue.reduce((s: number, i: any) => s + (i.amount_cents ?? 0), 0))}).` });
  const openOffers = specialOffers.filter((o: any) => !o.paid_at && o.expires_at > new Date().toISOString());
  if (openOffers.length) issues.push({ level: "info", text: `${openOffers.length} offre(s) spéciale(s) en cours : ${openOffers.map((o: any) => `${o.parent_name ?? o.title} (expire le ${day(o.expires_at)})`).join(", ")}.` });
  const unsigned = contracts.filter((k: any) => k.status === "sent");
  if (unsigned.length) issues.push({ level: "orange", text: `Contrat(s) d'embauche pas encore signé(s) : ${unsigned.map((k: any) => k.employee_name).join(", ")}.` });
  const openPartnerOffers = offers.filter((o: any) => o.status !== "accepted" && o.status !== "closed");
  if (openPartnerOffers.length) issues.push({ level: "info", text: `Offres de partenariat en attente de réponse : ${openPartnerOffers.map((o: any) => o.company_name).join(", ")}.` });
  const upcomingTrials = boysTrials.filter((t: any) => t.status === "confirmed" && String(t.trial_date).slice(0, 10) >= today);
  if (upcomingTrials.length) issues.push({ level: "info", text: `${upcomingTrials.length} essai(s) gratuit(s) garçons à venir.` });
  const unsold = sponsorSlots.filter((s: any) => s.status === "available");
  if (unsold.length) issues.push({ level: "info", text: `Commandites 2027 : ${unsold.length} emplacement(s) encore à vendre (${money(unsold.reduce((s: number, x: any) => s + (x.price_cents ?? 0), 0))} de potentiel).` });
  const pendingShop = shopOrders.filter((o: any) => o.status === "paid");
  if (pendingShop.length) issues.push({ level: "info", text: `${pendingShop.length} commande(s) boutique payée(s) à remettre.` });

  // ── Chronologie automatique ──
  const timeline: TimelineItem[] = [];
  const first = (list: any[], pred: (x: any) => boolean = () => true) => list.filter(pred).map((x) => x.created_at).sort()[0];
  const add = (date: string | undefined, text: string) => date && timeline.push({ date: day(date), text });
  add(first(leads), "Première inscription en ligne (saison Été 2026)");
  add(first(leads, (l) => l.status === "paid"), "Premier paiement d'une famille");
  add(first(regs, (r) => r.season_id === "automne-hiver-2026"), "Ouverture des inscriptions Automne/Hiver 2026");
  add(first(regs, (r) => r.season_id === "automne-hiver-2026" && r.status === "paid"), "Première joueuse inscrite à l'Automne/Hiver 2026");
  add(first(sportEtudes), "Première inscription Sport-Études");
  for (const p of sessionPrograms.filter((p: any) => !/retir/i.test(p.name))) add(p.created_at, `Création du programme « ${p.name} »`);
  add(first(sessionRegs, (r) => boysSlugs.has(r.program_slug) && r.status === "paid"), "Premier garçon inscrit");
  add(first(sponsors, (s) => s.status === "paye"), "Premier commanditaire payé");
  add(first(offers), "Premières offres de partenariat envoyées");
  add(first(matchSlots), "Mise en vente des plages de matchs");
  add(first(shopOrders, (o) => o.status !== "pending"), "Première commande à la boutique");
  add(first(contracts), "Premier contrat d'embauche en ligne");
  for (const k of contracts.filter((k: any) => k.signed_at)) add(k.signed_at, `Contrat signé : ${k.employee_name}`);
  // Jalons du mois : nombre d'inscriptions payées (filles + garçons + Sport-Études) par mois.
  const byMonth = new Map<string, number>();
  for (const r of [...regs.filter((r: any) => r.status === "paid"), ...paidBoysPrograms, ...sportEtudesActive, ...summerPaid]) {
    const m = String(r.updated_at ?? r.created_at).slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  return {
    generatedAt: new Date().toISOString(),
    keyFigures,
    programs: { girls: girlsPrograms, boys: boysPrograms, other },
    clientele: {
      girlsByYear: tally(paidGirls.map((r: any) => String(r.category_id ?? ""))).sort((a, b) => a.label.localeCompare(b.label)),
      boysByYear: tally([
        ...paidBoys.map((r: any) => String(r.birth_year ?? r.player_dob?.slice(0, 4) ?? (r.program_slug === "intensif-garcons" ? "2015" : ""))),
        ...sportEtudesActive.map((r: any) => String(r.player_birth_year ?? r.player_dob?.slice(0, 4) ?? ""))
      ].filter((y) => Number(y) >= 2005 && Number(y) <= new Date().getFullYear() - 3)).sort((a, b) => a.label.localeCompare(b.label)),
      cities: cities.slice(0, 15),
      clubs: clubs.slice(0, 12),
      sources: mergedSources,
      siblingFamilies: [...familyChildren.values()].filter((n) => n > 1).length,
      families: familyChildren.size
    },
    revenue: revenue
      ? {
          ...revenue,
          months: revenue.months.length
            ? revenue.months
            : [...byMonth.entries()].sort().map(([month]) => ({ month, revenueCents: 0, expenseCents: 0 }))
        }
      : null,
    team,
    partners,
    groups,
    issues,
    timeline: [
      ...timeline,
      ...audit
        .filter((a: any) => !/\bzz|test/i.test(String(a.entity_label ?? "")))
        .map((a: any) => ({ date: day(a.created_at), text: `${actionLabel(a.action)} — ${String(a.entity_label ?? "").replace(/\s+/g, " ")}`.trim() }))
    ]
      .filter((t, i, all) => all.findIndex((x) => x.date === t.date && x.text === t.text) === i)
      .sort((a, b) => a.date.localeCompare(b.date))
  };
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    status_change: "Changement de statut",
    delete: "Suppression",
    full_refund: "Remboursement complet",
    partial_refund: "Remboursement partiel",
    trial_converted: "Essai converti en inscription",
    trial_scheduled: "Essai planifié",
    installment_cancelled: "Versement annulé",
    season_completion: "Demi-saison complétée",
    special_offer_paid: "Offre spéciale payée"
  };
  return map[action] ?? action;
}

import { CLUB_ID } from "@/lib/club";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Registre des contrats (Mandalart P7.6.03, automatisation AU10).
 *
 *  Une seule liste de toutes les échéances : locations de terrains et de gymnases (`venue_rentals`),
 *  contrats d'embauche (`employee_contracts`), commandites (`sponsors` + `sponsor_slots_2027`),
 *  et ce qui n'existe nulle part ailleurs (assurances, logiciels, fournisseurs), saisi dans
 *  `contract_registry`. Une ligne de `contract_registry` reliée à un contrat d'origine en précise les
 *  dates, le renouvellement, le montant ou la décision ; les tables d'origine ne sont jamais modifiées.
 *
 *  Alerte 90 jours avant l'échéance (60 jours pour une commandite). Une échéance = la date de fin,
 *  moins le préavis s'il y en a un. Un contrat à renouvellement automatique dont la date est passée
 *  est prolongé d'une durée égale à son terme (12 mois par défaut) ; s'il se renouvelle plus souvent que la
 *  fenêtre d'alerte (abonnement au mois), il ne déclenche pas d'alerte.
 *
 *  La première partie du fichier est pure (testée dans contracts-registry.test.ts) ; la seconde lit et
 *  écrit la base. */

// ───────────────────────────── Types et libellés ─────────────────────────────

export type ContractKind = "terrain" | "gymnase" | "embauche" | "commandite" | "assurance" | "logiciel" | "fournisseur" | "autre";
export type RenewalMode = "manuel" | "automatique" | "aucun";
export type AmountPeriod = "total" | "annuel" | "mensuel";
export type ContractSource = "venue_rental" | "employee_contract" | "sponsor";
export type DateOrigin = "saisie" | "texte" | "estimee" | "aucune";
export type ContractState = "echu" | "alerte" | "a-venir" | "sans-date" | "termine";

export const CONTRACT_KINDS: { value: ContractKind; label: string }[] = [
  { value: "terrain", label: "Terrain" },
  { value: "gymnase", label: "Gymnase" },
  { value: "embauche", label: "Embauche" },
  { value: "commandite", label: "Commandite" },
  { value: "assurance", label: "Assurance" },
  { value: "logiciel", label: "Logiciel" },
  { value: "fournisseur", label: "Fournisseur" },
  { value: "autre", label: "Autre" }
];
export const KIND_LABEL = Object.fromEntries(CONTRACT_KINDS.map((k) => [k.value, k.label])) as Record<ContractKind, string>;

export const RENEWAL_LABEL: Record<RenewalMode, string> = {
  manuel: "À renégocier",
  automatique: "Renouvellement automatique",
  aucun: "Se termine (pas de renouvellement)"
};

export const AMOUNT_PERIOD_LABEL: Record<AmountPeriod, string> = { total: "pour la durée du contrat", annuel: "par année", mensuel: "par mois" };

/** Alerte par défaut : 90 jours avant l'échéance, 60 pour une commandite (plan, AU10). */
export const defaultAlertDays = (kind: ContractKind) => (kind === "commandite" ? 60 : 90);

/** Un contrat terminé depuis plus de 30 jours sans décision quitte la liste « à décider ». */
export const ENDED_GRACE_DAYS = 30;

/** Ligne de `contract_registry`. */
export interface RegistryRow {
  id: string;
  source_type: ContractSource | null;
  source_id: string | null;
  kind: ContractKind;
  title: string | null;
  supplier: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal: RenewalMode;
  notice_days: number | null;
  alert_days: number | null;
  amount_cents: number | null;
  amount_period: AmountPeriod;
  status: "actif" | "termine";
  decision_note: string | null;
  decided_at: string | null;
  notes: string | null;
  updated_at?: string | null;
}

/** Colonnes lues des tables d'origine (lecture seule ; jamais le NAS ni les coordonnées). */
export interface VenueRentalRow {
  id: string;
  season_key: string;
  venue: string;
  space: string | null;
  period: string;
  schedule: string;
  total_cents: number;
  payments: string | null;
}
export interface EmployeeContractRow {
  id: string;
  employee_name: string;
  title: string;
  status: "sent" | "signed" | "cancelled";
  summary: { label: string; value: string }[] | null;
  pay_schedule: { period?: string; payDate?: string; amountCents?: number }[] | null;
  signed_at: string | null;
}
export interface SponsorRow {
  id: string;
  company_name: string;
  category: string;
  partnership_type: string | null;
  proposed_amount_cents: number;
  status: string;
}
export interface SponsorSlotRow {
  slot_key: string;
  tier_label: string;
  placement: string;
  price_cents: number;
  status: string;
  sponsor_id: string | null;
}
export interface PartnershipOfferRow {
  sponsor_id: string | null;
  status: string;
  accepted_at: string | null;
}

/** Un contrat du registre, quelle que soit son origine. */
export interface ContractEntry {
  /** Identifiant stable : `manuel:<id>` ou `<source>:<id d'origine>`. */
  key: string;
  registryId: string | null;
  source: ContractSource | null;
  sourceId: string | null;
  kind: ContractKind;
  title: string;
  supplier: string | null;
  startDate: string | null;
  endDate: string | null;
  /** D'où vient la date de fin : saisie dans le registre, lue dans le texte du contrat, estimée, aucune. */
  dateOrigin: DateOrigin;
  /** Texte d'origine montré à côté d'une date lue ou estimée, pour que JP puisse la vérifier. */
  dateHint: string | null;
  renewal: RenewalMode;
  noticeDays: number | null;
  alertDays: number;
  amountCents: number | null;
  amountPeriod: AmountPeriod;
  /** Une commandite est un revenu ; tout le reste est une dépense. */
  isRevenue: boolean;
  status: "actif" | "termine";
  decisionNote: string | null;
  decidedAt: string | null;
  notes: string | null;
  /** Précision affichée sous le titre (horaire, poste, emplacement du chandail…). */
  detail: string | null;
  /** Écran de l'admin où le contrat d'origine se gère. */
  href: string | null;
  /** Valeurs lues dans le contrat d'origine, avant les précisions du registre (null pour un contrat saisi à la main). */
  origin: ContractOrigin | null;
}

export interface ContractOrigin {
  startDate: string | null;
  endDate: string | null;
  amountCents: number | null;
  supplier: string | null;
}

export interface ContractTimeline extends ContractEntry {
  /** Date de fin après les renouvellements automatiques. */
  effectiveEnd: string | null;
  /** Date limite pour décider : fin moins le préavis. */
  deadline: string | null;
  /** Début de l'alerte : échéance moins 90 (ou 60) jours. */
  alertFrom: string | null;
  /** Jours avant l'échéance (négatif = dépassée). */
  daysLeft: number | null;
  /** Jours avant la fin du contrat (négatif = terminé). */
  daysToEnd: number | null;
  /** Nombre de renouvellements automatiques appliqués. */
  rolled: number;
  state: ContractState;
  /** Terminé depuis plus de 30 jours, sans décision notée. */
  autoEnded: boolean;
}

// ───────────────────────────── Dates ─────────────────────────────

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDay(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const s = String(value).slice(0, 10);
  return ISO.test(s) ? s : null;
}

/** Jour à Montréal d'un horodatage (« 2026-11-07T01:30:00Z » = le 6 novembre) ; une date AAAA-MM-JJ reste telle quelle. */
export function torontoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  if (ISO.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? toIsoDay(value) : d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);
export const addDays = (iso: string, n: number) => fromUtc(utc(iso) + n * 86_400_000);

/** Ajoute des mois en gardant le jour (le 31 janvier + 1 mois = le 28 ou 29 février). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d, last))}`;
}

/** Nombre de mois entiers (arrondi) entre deux dates. */
export function monthsBetween(from: string, to: string): number {
  return Math.round(daysBetween(from, to) / 30.4375);
}

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, fevr: 2, fev: 2,
  mars: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12
};
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
const DATE_RE = new RegExp(`(\\d{1,2})(?:er)?\\s+(${MONTH_RE})(?![a-z])\\.?(?:\\s+(\\d{4}))?`, "g");

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface LooseDate {
  day: number;
  month: number;
  year: number | null;
}

/** Toutes les dates en français d'un texte (« 1er octobre 2026 », « 25 mai », « 24 avr. 2027 »). */
export function findFrenchDates(text: string): LooseDate[] {
  const out: LooseDate[] = [];
  for (const m of normalize(text).matchAll(DATE_RE)) {
    out.push({ day: Number(m[1]), month: MONTHS[m[2]], year: m[3] ? Number(m[3]) : null });
  }
  return out;
}

function validIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d > last ? null : `${y}-${pad(m)}-${pad(d)}`;
}

/** Lit une période écrite à la main (« 25 mai au 18 septembre 2026 », « Du 25 octobre 2026 au 18 avril
 *  2027 (…) »). Prudence : la fin doit avoir son année ; le début sans année prend celle de la fin
 *  (ou l'année d'avant s'il tombe après la fin). Sinon, rien n'est deviné. */
export function parseFrenchPeriod(text: string | null | undefined): { start: string | null; end: string | null } {
  if (!text) return { start: null, end: null };
  const dates = findFrenchDates(text);
  if (dates.length === 0) return { start: null, end: null };
  if (dates.length === 1) {
    const only = dates[0];
    const isEnd = /jusqu/.test(normalize(text));
    if (!isEnd || only.year === null) return { start: null, end: null };
    return { start: null, end: validIso(only.year, only.month, only.day) };
  }
  const [a, b] = dates;
  if (b.year === null) return { start: null, end: null };
  const end = validIso(b.year, b.month, b.day);
  if (!end) return { start: null, end: null };
  let startYear = a.year;
  if (startYear === null) startYear = a.month > b.month || (a.month === b.month && a.day > b.day) ? b.year - 1 : b.year;
  const start = validIso(startYear, a.month, a.day);
  return { start: start && start <= end ? start : null, end };
}

// ───────────────────────────── Contrats d'origine → entrées ─────────────────────────────

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim() || null;

function venueKind(v: VenueRentalRow): ContractKind {
  return /gymnase/i.test(`${v.space ?? ""} ${v.venue}`) ? "gymnase" : "terrain";
}

function fromVenueRental(v: VenueRentalRow): ContractEntry {
  const p = parseFrenchPeriod(v.period);
  return {
    key: `venue_rental:${v.id}`,
    registryId: null,
    source: "venue_rental",
    sourceId: v.id,
    kind: venueKind(v),
    title: v.space ? `${v.venue} · ${v.space}` : v.venue,
    supplier: v.venue,
    startDate: p.start,
    endDate: p.end,
    dateOrigin: p.end ? "texte" : "aucune",
    dateHint: v.period,
    renewal: "manuel",
    noticeDays: null,
    alertDays: 90,
    amountCents: v.total_cents ?? null,
    amountPeriod: "total",
    isRevenue: false,
    status: "actif",
    decisionNote: null,
    decidedAt: null,
    notes: v.payments,
    detail: clean(v.schedule),
    href: "/admin/historique",
    origin: null
  };
}

function fromEmployeeContract(c: EmployeeContractRow): ContractEntry {
  const duration = (c.summary ?? []).find((s) => /^dur/i.test(normalize(s.label ?? "")))?.value ?? null;
  let p = parseFrenchPeriod(duration);
  let origin: DateOrigin = p.end ? "texte" : "aucune";
  let hint = duration;
  if (!p.end) {
    // Pas de durée lisible : la dernière période de paie donne une fin estimée.
    const last = [...(c.pay_schedule ?? [])].filter((r) => r.period).pop();
    const q = parseFrenchPeriod(last?.period ?? null);
    if (q.end) {
      p = { start: p.start, end: q.end };
      origin = "estimee";
      hint = `Dernière période de paie : ${last!.period}`;
    }
  }
  const pay = (c.pay_schedule ?? []).reduce((s, r) => s + (Number(r.amountCents) || 0), 0);
  return {
    key: `employee_contract:${c.id}`,
    registryId: null,
    source: "employee_contract",
    sourceId: c.id,
    kind: "embauche",
    title: c.employee_name,
    supplier: null,
    startDate: p.start,
    endDate: p.end,
    dateOrigin: origin,
    dateHint: hint,
    renewal: "manuel",
    noticeDays: null,
    alertDays: 90,
    amountCents: pay > 0 ? pay : null,
    amountPeriod: "total",
    isRevenue: false,
    status: c.status === "cancelled" ? "termine" : "actif",
    decisionNote: null,
    decidedAt: null,
    notes: null,
    detail: c.status === "signed" ? c.title : `${c.title} · pas encore signé`,
    href: "/admin/contrats",
    origin: null
  };
}

/** Commandites actives seulement (confirmées, payées ou terminées) : une négociation n'est pas un contrat. */
export const ACTIVE_SPONSOR_STATUSES = ["confirme", "paye", "termine"];

function fromSponsor(s: SponsorRow, slot: SponsorSlotRow | undefined, offer: PartnershipOfferRow | undefined): ContractEntry {
  const year = Number((s.partnership_type ?? "").match(/\b(20\d{2})\b/)?.[1] ?? (slot ? 2027 : NaN));
  const end = Number.isFinite(year) ? `${year}-12-31` : null;
  return {
    key: `sponsor:${s.id}`,
    registryId: null,
    source: "sponsor",
    sourceId: s.id,
    kind: "commandite",
    title: s.company_name,
    supplier: s.company_name,
    startDate: torontoDay(offer?.accepted_at ?? null),
    endDate: end,
    dateOrigin: end ? "estimee" : "aucune",
    dateHint: end ? `Commandite de la saison ${year} : fin estimée au 31 décembre ${year}` : clean(s.partnership_type),
    renewal: "manuel",
    noticeDays: null,
    alertDays: 60,
    amountCents: slot?.price_cents ?? (s.proposed_amount_cents || null),
    amountPeriod: "total",
    isRevenue: true,
    status: s.status === "termine" ? "termine" : "actif",
    decisionNote: null,
    decidedAt: null,
    notes: null,
    detail: slot ? `${slot.tier_label} · ${slot.placement}` : clean(s.partnership_type),
    href: "/admin/commandites",
    origin: null
  };
}

function fromManual(r: RegistryRow): ContractEntry {
  return {
    key: `manuel:${r.id}`,
    registryId: r.id,
    source: null,
    sourceId: null,
    kind: r.kind,
    title: r.title ?? "Contrat sans nom",
    supplier: r.supplier,
    startDate: toIsoDay(r.start_date),
    endDate: toIsoDay(r.end_date),
    dateOrigin: r.end_date ? "saisie" : "aucune",
    dateHint: null,
    renewal: r.renewal,
    noticeDays: r.notice_days,
    alertDays: r.alert_days ?? defaultAlertDays(r.kind),
    amountCents: r.amount_cents,
    amountPeriod: r.amount_period,
    isRevenue: r.kind === "commandite",
    status: r.status,
    decisionNote: r.decision_note,
    decidedAt: r.decided_at,
    notes: r.notes,
    detail: null,
    href: null,
    origin: null
  };
}

/** Les précisions saisies dans le registre l'emportent sur ce qui est lu dans le contrat d'origine. */
export function applyOverride(base: ContractEntry, r: RegistryRow | undefined): ContractEntry {
  if (!r) return base;
  const end = toIsoDay(r.end_date);
  const kind = r.kind ?? base.kind;
  return {
    ...base,
    registryId: r.id,
    kind,
    title: r.title ?? base.title,
    supplier: r.supplier ?? base.supplier,
    startDate: toIsoDay(r.start_date) ?? base.startDate,
    endDate: end ?? base.endDate,
    dateOrigin: end ? "saisie" : base.dateOrigin,
    dateHint: end ? null : base.dateHint,
    renewal: r.renewal,
    noticeDays: r.notice_days ?? base.noticeDays,
    // Type changé dans le registre (ex. en commandite) : l'alerte par défaut suit le nouveau type.
    alertDays: r.alert_days ?? (kind !== base.kind ? defaultAlertDays(kind) : base.alertDays),
    amountCents: r.amount_cents ?? base.amountCents,
    amountPeriod: r.amount_cents !== null ? r.amount_period : base.amountPeriod,
    status: r.status === "termine" ? "termine" : base.status,
    decisionNote: r.decision_note,
    decidedAt: r.decided_at,
    notes: r.notes ?? base.notes
  };
}

export interface RegistrySources {
  registry: RegistryRow[];
  venueRentals: VenueRentalRow[];
  employeeContracts: EmployeeContractRow[];
  sponsors: SponsorRow[];
  sponsorSlots: SponsorSlotRow[];
  partnershipOffers: PartnershipOfferRow[];
}

/** Assemble la liste unifiée des contrats (sans calcul d'échéance). */
export function buildEntries(src: RegistrySources): ContractEntry[] {
  const overrides = new Map(src.registry.filter((r) => r.source_type && r.source_id).map((r) => [`${r.source_type}:${r.source_id}`, r]));
  const used = new Set<string>();
  const take = (e: ContractEntry) => {
    used.add(e.key);
    const origin: ContractOrigin = { startDate: e.startDate, endDate: e.endDate, amountCents: e.amountCents, supplier: e.supplier };
    return applyOverride({ ...e, origin }, overrides.get(e.key));
  };
  const out: ContractEntry[] = [];
  for (const v of src.venueRentals) out.push(take(fromVenueRental(v)));
  for (const c of src.employeeContracts) out.push(take(fromEmployeeContract(c)));
  for (const s of src.sponsors) {
    if (!ACTIVE_SPONSOR_STATUSES.includes(s.status)) continue;
    const slot = src.sponsorSlots.find((x) => x.sponsor_id === s.id && x.status === "sold");
    const offer = src.partnershipOffers.find((o) => o.sponsor_id === s.id && o.status === "accepted");
    out.push(take(fromSponsor(s, slot, offer)));
  }
  for (const r of src.registry) {
    if (!r.source_type) out.push(fromManual(r));
    else if (!used.has(`${r.source_type}:${r.source_id}`) && r.title) {
      // Contrat d'origine supprimé : on garde ce qui a été saisi.
      out.push({ ...fromManual(r), key: `${r.source_type}:${r.source_id}`, source: r.source_type, sourceId: r.source_id });
    }
  }
  return out;
}

// ───────────────────────────── Échéances ─────────────────────────────

/** Calcule l'échéance d'un contrat à la date `today` (AAAA-MM-JJ). */
export function computeTimeline(e: ContractEntry, today: string): ContractTimeline {
  let end = e.endDate;
  let rolled = 0;
  const auto = e.renewal === "automatique" && e.status === "actif";
  if (end && auto && end < today) {
    const term = e.startDate && e.startDate < end ? Math.max(1, monthsBetween(e.startDate, end)) : 12;
    while (end < today && rolled < 600) {
      end = addMonths(end, term);
      rolled += 1;
    }
  }
  // Abonnement court qui se renouvelle seul (au mois, par exemple) : son terme est plus court que la fenêtre
  // d'alerte, il n'y a rien à décider à chaque renouvellement. Il reste dans « À venir » au lieu d'occuper
  // « À décider » et Aujourd'hui en permanence.
  const termDays = e.startDate && e.endDate && e.startDate < e.endDate ? daysBetween(e.startDate, e.endDate) : 365;
  const shortAuto = auto && termDays <= e.alertDays;
  const deadline = end ? addDays(end, -(e.noticeDays ?? 0)) : null;
  const alertFrom = deadline && !shortAuto ? addDays(deadline, -e.alertDays) : null;
  const daysLeft = deadline ? daysBetween(today, deadline) : null;
  const daysToEnd = end ? daysBetween(today, end) : null;

  let state: ContractState;
  let autoEnded = false;
  if (e.status === "termine") state = "termine";
  else if (daysToEnd === null || daysLeft === null) state = "sans-date";
  else if (daysToEnd < -ENDED_GRACE_DAYS) {
    state = "termine";
    autoEnded = true;
  } else if (daysToEnd < 0) state = "echu";
  else if (daysLeft <= e.alertDays && !shortAuto) state = "alerte";
  else state = "a-venir";

  return { ...e, effectiveEnd: end, deadline, alertFrom, daysLeft, daysToEnd, rolled, state, autoEnded };
}

const byDeadline = (a: ContractTimeline, b: ContractTimeline) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || a.title.localeCompare(b.title, "fr");

export interface RegistryOverview {
  today: string;
  all: ContractTimeline[];
  /** Échéance dépassée depuis moins de 30 jours, ou dans la fenêtre d'alerte. */
  toDecide: ContractTimeline[];
  /** Hors alerte, mais la date de fin manque ou n'est qu'estimée. */
  toComplete: ContractTimeline[];
  upcoming: ContractTimeline[];
  ended: ContractTimeline[];
  /** Dépenses engagées des contrats en cours (abonnements ramenés à 12 mois). */
  committedCents: number;
  sponsorCents: number;
}

/** Montant d'un contrat sur 12 mois pour un abonnement, ou total pour un contrat à durée fixe. */
export const yearlyAmount = (c: Pick<ContractEntry, "amountCents" | "amountPeriod">) =>
  c.amountCents === null ? 0 : c.amountPeriod === "mensuel" ? c.amountCents * 12 : c.amountCents;

export function summarize(entries: ContractEntry[], today: string): RegistryOverview {
  const all = entries.map((e) => computeTimeline(e, today)).sort(byDeadline);
  const toDecide = all.filter((c) => c.state === "echu" || c.state === "alerte");
  const toComplete = all.filter((c) => c.state === "sans-date" || (c.state === "a-venir" && c.dateOrigin === "estimee"));
  const upcoming = all.filter((c) => c.state === "a-venir");
  const ended = all.filter((c) => c.state === "termine").sort((a, b) => (b.effectiveEnd ?? "").localeCompare(a.effectiveEnd ?? ""));
  const running = all.filter((c) => c.state !== "termine");
  return {
    today,
    all,
    toDecide,
    toComplete,
    upcoming,
    ended,
    committedCents: running.filter((c) => !c.isRevenue).reduce((s, c) => s + yearlyAmount(c), 0),
    sponsorCents: running.filter((c) => c.isRevenue).reduce((s, c) => s + yearlyAmount(c), 0)
  };
}

// ───────────────────────────── Libellés ─────────────────────────────

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function dayFr(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** « dans 45 jours », « demain », « aujourd'hui », « il y a 3 jours ». */
export function relativeDays(n: number | null): string {
  if (n === null) return "";
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  return n > 0 ? `dans ${n} jours` : `il y a ${-n} jours`;
}

/** Ce qui arrive à l'échéance, en une phrase. */
export function deadlineLabel(c: ContractTimeline): string {
  if (!c.effectiveEnd) return "Date de fin à saisir";
  if (c.state === "echu") return `Terminé le ${dayFr(c.effectiveEnd)} (${relativeDays(c.daysToEnd)})`;
  if (c.state === "termine") return c.autoEnded || (c.daysToEnd ?? 0) < 0 ? `Terminé le ${dayFr(c.effectiveEnd)}` : `Se termine le ${dayFr(c.effectiveEnd)} (non renouvelé)`;
  if (c.noticeDays && c.deadline !== c.effectiveEnd) return `Préavis avant le ${dayFr(c.deadline)} (${relativeDays(c.daysLeft)}) · fin le ${dayFr(c.effectiveEnd)}`;
  if (c.renewal === "automatique") return `Se renouvelle le ${dayFr(c.effectiveEnd)} (${relativeDays(c.daysToEnd)})`;
  return `Fin le ${dayFr(c.effectiveEnd)} (${relativeDays(c.daysToEnd)})`;
}

const money = (c: number) => `${Math.round(c / 100).toLocaleString("fr-CA")} $`;
export const amountLabel = (c: Pick<ContractEntry, "amountCents" | "amountPeriod">) =>
  c.amountCents === null ? null : c.amountPeriod === "total" ? money(c.amountCents) : `${money(c.amountCents)} ${AMOUNT_PERIOD_LABEL[c.amountPeriod]}`;

/** Ce qu'il faut faire, selon le type de contrat. */
export function actionHint(c: ContractTimeline): string {
  if (c.state === "echu") return "Terminé : noter s'il est renouvelé ou non";
  if (c.renewal === "automatique") return c.noticeDays ? "Se renouvelle seul : annuler avant le préavis si on n'en veut plus" : "Se renouvelle seul : vérifier le prix et les conditions";
  switch (c.kind) {
    case "commandite":
      return "Rencontre de renouvellement avec le commanditaire";
    case "embauche":
      return "Décider du retour pour la prochaine saison";
    case "terrain":
    case "gymnase":
      return "Réserver la prochaine saison avant de perdre les heures";
    case "assurance":
      return "Demander la soumission de renouvellement";
    default:
      return "Renégocier ou remplacer";
  }
}

/** Lignes prêtes pour la page « Aujourd'hui » (même forme que `TodayItem` de admin-today.ts). */
export function contractTodayItems(alerts: ContractTimeline[]): { title: string; detail: string | null; meta: string | null; href: string }[] {
  return alerts.map((c) => ({
    title: `${c.title} : ${c.state === "echu" ? `terminé le ${dayFr(c.effectiveEnd)}` : c.noticeDays && c.deadline !== c.effectiveEnd ? `préavis avant le ${dayFr(c.deadline)}` : `fin le ${dayFr(c.effectiveEnd)}`}`,
    detail: [KIND_LABEL[c.kind], amountLabel(c), actionHint(c)].filter(Boolean).join(" · "),
    meta: c.state === "echu" ? "Décision à noter" : relativeDays(c.daysLeft),
    href: `/admin/registre-contrats#${anchorId(c.key)}`
  }));
}

export const anchorId = (key: string) => `c-${key.replace(/[^a-zA-Z0-9-]/g, "-")}`;

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** Bloc du courriel du lundi (AU10) : contrats dans la fenêtre d'alerte. Vide s'il n'y a rien. */
export function contractAlertsEmailHtml(alerts: ContractTimeline[], siteUrl: string): string {
  if (!alerts.length) return "";
  const li = (c: ContractTimeline) =>
    `<li style="margin:0 0 6px"><strong>${esc(c.title)}</strong> — ${esc(deadlineLabel(c))}<br><span style="color:#666;font-size:13px">${esc([KIND_LABEL[c.kind], amountLabel(c), actionHint(c)].filter(Boolean).join(" · "))}</span></li>`;
  return `<h2 style="font-size:17px;margin:20px 0 8px">Échéances des contrats · ${alerts.length}</h2><ul style="padding-left:18px;margin:0">${alerts.map(li).join("")}</ul><p style="margin:6px 0 0;font-size:13px"><a href="${siteUrl}/admin/registre-contrats">Ouvrir le registre des contrats</a></p>`;
}

// ───────────────────────────── Base de données ─────────────────────────────

function db() {
  return getSupabaseAdminClient() as any;
}

export const torontoToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

const REGISTRY_COLUMNS =
  "id, source_type, source_id, kind, title, supplier, start_date, end_date, renewal, notice_days, alert_days, amount_cents, amount_period, status, decision_note, decided_at, notes, updated_at";

async function rowsOf<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>, required = false): Promise<T[]> {
  const { data, error } = await q;
  if (error && required) throw new Error(error.message);
  return data ?? [];
}

export async function loadRegistrySources(): Promise<RegistrySources> {
  const [registry, venueRentals, employeeContracts, sponsors, sponsorSlots, partnershipOffers] = await Promise.all([
    rowsOf<RegistryRow>(db().from("contract_registry").select(REGISTRY_COLUMNS).eq("club_id", CLUB_ID), true),
    rowsOf<VenueRentalRow>(db().from("venue_rentals").select("id, season_key, venue, space, period, schedule, total_cents, payments").order("created_at")),
    // Jamais le NAS, le chèque ni les coordonnées : seulement ce qu'il faut pour l'échéance.
    rowsOf<EmployeeContractRow>(db().from("employee_contracts").select("id, employee_name, title, status, summary, pay_schedule, signed_at").order("created_at")),
    rowsOf<SponsorRow>(db().from("sponsors").select("id, company_name, category, partnership_type, proposed_amount_cents, status").in("status", ACTIVE_SPONSOR_STATUSES)),
    rowsOf<SponsorSlotRow>(db().from("sponsor_slots_2027").select("slot_key, tier_label, placement, price_cents, status, sponsor_id").not("sponsor_id", "is", null)),
    rowsOf<PartnershipOfferRow>(db().from("partnership_offers").select("sponsor_id, status, accepted_at").eq("status", "accepted"))
  ]);
  return { registry, venueRentals, employeeContracts, sponsors, sponsorSlots, partnershipOffers };
}

export async function getRegistryOverview(today = torontoToday()): Promise<RegistryOverview> {
  return summarize(buildEntries(await loadRegistrySources()), today);
}

/** Contrats à décider (fenêtre d'alerte ou terminés depuis moins de 30 jours), pour « Aujourd'hui » et le courriel du lundi. */
export async function getContractAlerts(today = torontoToday()): Promise<ContractTimeline[]> {
  return (await getRegistryOverview(today)).toDecide;
}

export interface ContractRef {
  id?: string | null;
  sourceType?: ContractSource | null;
  sourceId?: string | null;
}

export interface ContractInput {
  kind: ContractKind;
  title?: string | null;
  supplier?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  renewal: RenewalMode;
  noticeDays?: number | null;
  alertDays?: number | null;
  amountCents?: number | null;
  amountPeriod?: AmountPeriod;
  notes?: string | null;
}

async function findRow(ref: ContractRef): Promise<RegistryRow | null> {
  if (ref.id) {
    const { data } = await db().from("contract_registry").select(REGISTRY_COLUMNS).eq("club_id", CLUB_ID).eq("id", ref.id).maybeSingle();
    return data ?? null;
  }
  if (ref.sourceType && ref.sourceId) {
    const { data } = await db().from("contract_registry").select(REGISTRY_COLUMNS).eq("club_id", CLUB_ID).eq("source_type", ref.sourceType).eq("source_id", ref.sourceId).maybeSingle();
    return data ?? null;
  }
  return null;
}

/** Écrit (ou crée) la ligne du registre d'un contrat. Pour un contrat relié, seule la ligne de précisions change. */
async function writeRow(ref: ContractRef, patch: Record<string, unknown>, kindIfNew: ContractKind): Promise<{ id: string; before: RegistryRow | null }> {
  const before = await findRow(ref);
  const now = new Date().toISOString();
  if (before) {
    const { error } = await db().from("contract_registry").update({ ...patch, updated_at: now }).eq("id", before.id);
    if (error) throw new Error(error.message);
    return { id: before.id, before };
  }
  if (ref.id) throw new Error("Contrat introuvable");
  const { data, error } = await db()
    .from("contract_registry")
    .insert({ club_id: CLUB_ID, source_type: ref.sourceType ?? null, source_id: ref.sourceId ?? null, kind: kindIfNew, ...patch, updated_at: now })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, before: null };
}

/** Ajoute un contrat saisi à la main, ou enregistre les précisions d'un contrat relié. */
export async function saveContract(ref: ContractRef, input: ContractInput) {
  const isManual = !ref.sourceType;
  if (isManual && !input.title?.trim()) throw new Error("Donnez un nom au contrat.");
  if (input.startDate && input.endDate && input.startDate > input.endDate) throw new Error("La date de fin est avant la date de début.");
  const patch = {
    kind: input.kind,
    // Contrat relié : le nom vient du contrat d'origine.
    title: isManual ? input.title!.trim() : null,
    supplier: input.supplier?.trim() || null,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    renewal: input.renewal,
    notice_days: input.noticeDays ?? null,
    alert_days: input.alertDays ?? null,
    amount_cents: input.amountCents ?? null,
    amount_period: input.amountPeriod ?? "total",
    notes: input.notes?.trim() || null
  };
  return writeRow(ref, patch, input.kind);
}

/** Renouvelé : nouvelle date de fin ; le nouveau terme commence le lendemain de l'ancienne fin. */
export async function renewContract(ref: ContractRef, kind: ContractKind, previousEnd: string | null, newEnd: string, note?: string | null) {
  if (previousEnd && newEnd <= previousEnd) throw new Error("La nouvelle date de fin doit être après l'ancienne.");
  return writeRow(
    ref,
    {
      end_date: newEnd,
      ...(previousEnd ? { start_date: addDays(previousEnd, 1) } : {}),
      status: "actif",
      decided_at: new Date().toISOString(),
      decision_note: note?.trim() || `Renouvelé jusqu'au ${dayFr(newEnd)}`
    },
    kind
  );
}

/** Ne pas renouveler : le contrat sort des alertes et va dans « Terminés ». */
export async function endContract(ref: ContractRef, kind: ContractKind, note?: string | null) {
  return writeRow(ref, { status: "termine", decided_at: new Date().toISOString(), decision_note: note?.trim() || "Non renouvelé" }, kind);
}

/** Remet un contrat terminé dans le suivi. */
export async function reopenContract(ref: ContractRef, kind: ContractKind) {
  return writeRow(ref, { status: "actif", decided_at: null, decision_note: null }, kind);
}

/** Supprime un contrat saisi à la main, ou les précisions d'un contrat relié (il reprend les valeurs d'origine). */
export async function removeRegistryRow(id: string): Promise<RegistryRow | null> {
  const before = await findRow({ id });
  if (!before) return null;
  const { error } = await db().from("contract_registry").delete().eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw new Error(error.message);
  return before;
}

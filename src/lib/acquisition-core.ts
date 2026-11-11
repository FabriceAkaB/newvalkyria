/** Sources d'acquisition (Mandalart P3.8.01 / AU05) et entreprise des parents (P6.1.02).
 *  Fichier PUR : aucune base de données, utilisable dans les formulaires publics (client)
 *  comme dans les calculs de l'admin. Les accès à la base sont dans `acquisition.ts`. */

/* ════════════════════════════════════════════════════════════
   Les canaux : « Comment nous avez-vous connus ? »
   ════════════════════════════════════════════════════════════ */

/** Clés stables enregistrées en base (colonne `acquisition_source`). Ne jamais renommer une clé :
 *  ajouter une nouvelle clé à la fin si JP ajoute un canal. */
export const ACQUISITION_SOURCE_IDS = [
  "parrainage",
  "reseaux",
  "journee_valkyria",
  "parascolaire",
  "camp",
  "club_partenaire",
  "google",
  "publicite",
  "bouche_a_oreille",
  "autre"
] as const;

export type AcquisitionSource = (typeof ACQUISITION_SOURCE_IDS)[number];

/** Choix rapides de « Sur quel réseau ? » ; « Autre réseau » pour ne jamais bloquer un parent (WhatsApp, Snapchat…). */
export const SOCIAL_NETWORKS = ["Instagram", "Facebook", "YouTube", "TikTok", "Autre réseau"] as const;

export interface SourceDetailDef {
  /** Libellé de la précision demandée au parent. */
  label: string;
  required: boolean;
  placeholder?: string;
  /** Choix rapides (ex. le réseau social) au lieu d'un champ libre. */
  options?: readonly string[];
}

export interface SourceDef {
  id: AcquisitionSource;
  /** Libellé du formulaire (pages New Valkyria). */
  label: string;
  /** Libellé sans « Valkyria » pour les pages FC Atlantic. */
  neutralLabel?: string;
  /** Libellé court de l'admin. */
  short: string;
  detail?: SourceDetailDef;
}

export const ACQUISITION_SOURCES: readonly SourceDef[] = [
  {
    id: "parrainage",
    label: "Parrainage (une famille de Valkyria)",
    neutralLabel: "Parrainage (une famille du programme)",
    short: "Parrainage",
    detail: { label: "Code de référence ou nom de la famille", required: true, placeholder: "ex. ABC123 ou famille Tremblay" }
  },
  { id: "reseaux", label: "Vidéo / réseaux sociaux", short: "Vidéo et réseaux sociaux", detail: { label: "Sur quel réseau ?", required: true, options: SOCIAL_NETWORKS } },
  { id: "journee_valkyria", label: "Journée ou Rencontre Valkyria", neutralLabel: "Journée ou rencontre du club", short: "Journée ou Rencontre Valkyria" },
  { id: "parascolaire", label: "Parascolaire", short: "Parascolaire", detail: { label: "Quelle école ? (facultatif)", required: false } },
  { id: "camp", label: "Camp", short: "Camp", detail: { label: "Quel camp ? (facultatif)", required: false } },
  { id: "club_partenaire", label: "Club partenaire", short: "Club partenaire", detail: { label: "Quel club ? (facultatif)", required: false } },
  { id: "google", label: "Recherche Google", short: "Recherche Google" },
  { id: "publicite", label: "Publicité", short: "Publicité", detail: { label: "Où avez-vous vu la publicité ? (facultatif)", required: false, placeholder: "Facebook, Google, affiche…" } },
  { id: "bouche_a_oreille", label: "Bouche-à-oreille", short: "Bouche-à-oreille" },
  { id: "autre", label: "Autre", short: "Autre", detail: { label: "Précisez", required: true } }
];

const SOURCE_BY_ID = new Map<string, SourceDef>(ACQUISITION_SOURCES.map((s) => [s.id, s]));

export function isAcquisitionSource(value: unknown): value is AcquisitionSource {
  return typeof value === "string" && SOURCE_BY_ID.has(value);
}

export function sourceDef(id: string | null | undefined): SourceDef | null {
  return id ? SOURCE_BY_ID.get(id) ?? null : null;
}

/** Libellé court d'un canal pour l'admin ; « Source inconnue » si rien n'a été répondu. */
export function sourceLabel(id: string | null | undefined): string {
  return sourceDef(id)?.short ?? "Source inconnue";
}

/** Libellé d'un canal dans le formulaire, selon la marque de la page. */
export function sourceFormLabel(def: SourceDef, brand: "nv" | "atlantic" = "nv"): string {
  return brand === "atlantic" && def.neutralLabel ? def.neutralLabel : def.label;
}

/* ════════════════════════════════════════════════════════════
   Valeur du formulaire, validation, envoi
   ════════════════════════════════════════════════════════════ */

export interface AcquisitionValue {
  source: AcquisitionSource | "";
  detail: string;
  /** null = le parent n'a pas répondu (question facultative). */
  hasBusiness: boolean | null;
  businessName: string;
}

export const EMPTY_ACQUISITION: AcquisitionValue = { source: "", detail: "", hasBusiness: null, businessName: "" };

export type AcquisitionErrors = Partial<Record<"source" | "detail" | "businessName", string>>;

/** Erreurs à afficher sous la question. `detailProvided` : la précision est saisie ailleurs dans le
 *  formulaire (ex. le bloc « Recommandation » des programmes garçons pour le parrainage). */
export function acquisitionErrors(value: AcquisitionValue, options: { detailProvided?: boolean } = {}): AcquisitionErrors {
  const errors: AcquisitionErrors = {};
  const def = sourceDef(value.source);
  if (!def) {
    errors.source = "Dites-nous comment vous nous avez connus.";
  } else if (def.detail?.required && !options.detailProvided && !value.detail.trim()) {
    errors.detail =
      def.id === "reseaux" ? "Choisissez le réseau." : def.id === "parrainage" ? "Indiquez le code ou le nom de la famille." : "Précisez en quelques mots.";
  }
  if (value.hasBusiness === true && !value.businessName.trim()) errors.businessName = "Indiquez le nom de l'entreprise.";
  return errors;
}

export function hasAcquisitionErrors(errors: AcquisitionErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Première erreur, pour les formulaires qui n'affichent qu'un message en bas. */
export function firstAcquisitionError(errors: AcquisitionErrors): string | null {
  return errors.source ?? errors.detail ?? errors.businessName ?? null;
}

export interface AcquisitionPayload {
  source: AcquisitionSource;
  detail?: string;
  hasBusiness?: boolean | null;
  businessName?: string;
}

/** Ce que le formulaire envoie à la route (`acquisition` dans le corps JSON). */
export function toAcquisitionPayload(value: AcquisitionValue, detailOverride?: string | null): AcquisitionPayload | undefined {
  if (!isAcquisitionSource(value.source)) return undefined;
  const detail = (detailOverride ?? value.detail).trim();
  return {
    source: value.source,
    ...(detail ? { detail } : {}),
    hasBusiness: value.hasBusiness,
    ...(value.hasBusiness && value.businessName.trim() ? { businessName: value.businessName.trim() } : {})
  };
}

export interface AcquisitionColumns {
  acquisition_source: AcquisitionSource | null;
  acquisition_detail: string | null;
  has_business: boolean | null;
  business_name: string | null;
}

const clip = (s: unknown, max: number): string | null => {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

/** Colonnes à enregistrer à partir de ce qu'un client a envoyé. Tolérant : une valeur inconnue est
 *  ignorée (jamais d'erreur qui bloquerait une inscription ou un paiement). null = rien à enregistrer. */
export function acquisitionColumns(input: unknown): AcquisitionColumns | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const source = isAcquisitionSource(raw.source) ? raw.source : null;
  const hasBusiness = typeof raw.hasBusiness === "boolean" ? raw.hasBusiness : null;
  const columns: AcquisitionColumns = {
    acquisition_source: source,
    acquisition_detail: source ? clip(raw.detail, 200) : null,
    has_business: hasBusiness,
    business_name: hasBusiness ? clip(raw.businessName, 160) : null
  };
  return columns.acquisition_source || columns.has_business !== null ? columns : null;
}

/* ════════════════════════════════════════════════════════════
   Regroupements pour l'admin (fonctions pures, testées)
   ════════════════════════════════════════════════════════════ */

export type AcqTable = "registrations" | "session_program_registrations" | "sport_etudes_registrations" | "boys_trials";

export const ACQ_TABLES: readonly AcqTable[] = ["registrations", "session_program_registrations", "sport_etudes_registrations", "boys_trials"];

/** Une inscription ou un essai, ramené à la même forme quelle que soit la table. */
export interface AcqRecord {
  table: AcqTable;
  id: string;
  /** Libellé du programme (« Saison filles », « Garçons 2014 », « Sport-Études »…). */
  program: string;
  playerFirst: string;
  playerLast: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string | null;
  createdAt: string;
  source: string | null;
  detail: string | null;
  hasBusiness: boolean | null;
  businessName: string | null;
}

/** Texte comparable : sans accents, minuscules, espaces et traits d'union simplifiés. */
export function normalizeText(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-_.']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function playerKey(first: unknown, last: unknown): string {
  return `${normalizeText(first)}|${normalizeText(last)}`;
}

/** Une famille = un courriel de parent (sinon le nom du parent). */
export function familyKey(email: unknown, parentName?: unknown): string {
  const e = String(email ?? "").trim().toLowerCase();
  return e ? e : `nom:${normalizeText(parentName)}`;
}

/** Essais qui se sont transformés en inscription payée : même joueuse (prénom + nom, accents et
 *  majuscules ignorés), inscription payée créée le jour de l'essai ou après. Un essai filles converti
 *  sur place (même ligne) compte aussi : même identifiant. */
export function markConversions<T extends AcqRecord>(trials: T[], paid: AcqRecord[]): (T & { converted: boolean })[] {
  const byPlayer = new Map<string, AcqRecord[]>();
  for (const p of paid) {
    const k = playerKey(p.playerFirst, p.playerLast);
    if (k === "|") continue;
    byPlayer.set(k, [...(byPlayer.get(k) ?? []), p]);
  }
  return trials.map((t) => {
    const candidates = byPlayer.get(playerKey(t.playerFirst, t.playerLast)) ?? [];
    const converted = candidates.some((p) => (p.table === t.table && p.id === t.id) || p.createdAt.slice(0, 10) >= t.createdAt.slice(0, 10));
    return { ...t, converted };
  });
}

export interface ChannelRow {
  source: AcquisitionSource | null;
  label: string;
  /** Inscriptions payées venues de ce canal. */
  inscriptions: number;
  /** Part des inscriptions dont la source est connue (0 à 1) ; null pour « Source inconnue ». */
  share: number | null;
  trials: number;
  convertedTrials: number;
  /** Essais devenus inscriptions ÷ essais (0 à 1) ; null sans essai. */
  conversion: number | null;
  /** Précisions les plus fréquentes (réseau, club, camp…), au plus 3. */
  topDetails: { label: string; count: number }[];
}

function topDetails(records: AcqRecord[], max = 3): { label: string; count: number }[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const r of records) {
    const label = (r.detail ?? "").trim();
    if (!label) continue;
    const k = normalizeText(label);
    const cur = counts.get(k);
    counts.set(k, { label: cur?.label ?? label, count: (cur?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr")).slice(0, max);
}

/** Tableau par canal : inscriptions payées, essais et conversion essai → inscription.
 *  Les canaux sans aucune donnée sont omis ; « Source inconnue » est toujours en dernier. */
export function channelBreakdown(inscriptions: AcqRecord[], trials: (AcqRecord & { converted: boolean })[]): ChannelRow[] {
  const known = inscriptions.filter((r) => isAcquisitionSource(r.source)).length;
  const rows: ChannelRow[] = [];
  for (const def of ACQUISITION_SOURCES) {
    const ins = inscriptions.filter((r) => r.source === def.id);
    const tr = trials.filter((r) => r.source === def.id);
    if (!ins.length && !tr.length) continue;
    const conv = tr.filter((t) => t.converted).length;
    rows.push({
      source: def.id,
      label: def.short,
      inscriptions: ins.length,
      share: known ? ins.length / known : null,
      trials: tr.length,
      convertedTrials: conv,
      conversion: tr.length ? conv / tr.length : null,
      topDetails: topDetails([...ins, ...tr])
    });
  }
  rows.sort((a, b) => b.inscriptions - a.inscriptions || b.trials - a.trials || a.label.localeCompare(b.label, "fr"));
  const unknownIns = inscriptions.filter((r) => !isAcquisitionSource(r.source));
  const unknownTr = trials.filter((r) => !isAcquisitionSource(r.source));
  if (unknownIns.length || unknownTr.length) {
    const conv = unknownTr.filter((t) => t.converted).length;
    rows.push({
      source: null,
      label: "Source inconnue",
      inscriptions: unknownIns.length,
      share: null,
      trials: unknownTr.length,
      convertedTrials: conv,
      conversion: unknownTr.length ? conv / unknownTr.length : null,
      topDetails: []
    });
  }
  return rows;
}

export interface KnownShare {
  families: number;
  known: number;
  /** 0 à 100, arrondi au dixième ; null s'il n'y a aucune inscription. */
  pct: number | null;
}

/** Indicateur `source_connue` : familles inscrites (payées) dont au moins une inscription a une source. */
export function knownSourceShare(inscriptions: AcqRecord[]): KnownShare {
  const fam = new Map<string, boolean>();
  for (const r of inscriptions) {
    const k = familyKey(r.parentEmail, r.parentName);
    fam.set(k, Boolean(fam.get(k)) || isAcquisitionSource(r.source));
  }
  const families = fam.size;
  const known = [...fam.values()].filter(Boolean).length;
  return { families, known, pct: families ? Math.round((known / families) * 1000) / 10 : null };
}

export interface FamilyGroup {
  key: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string | null;
  players: string[];
  programs: string[];
  refs: { table: AcqTable; id: string }[];
  firstAt: string;
}

function groupFamilies(records: AcqRecord[]): FamilyGroup[] {
  const map = new Map<string, FamilyGroup>();
  for (const r of records) {
    const key = familyKey(r.parentEmail, r.parentName);
    const player = `${r.playerFirst} ${r.playerLast}`.replace(/\s+/g, " ").trim();
    const g = map.get(key) ?? { key, parentName: r.parentName, parentEmail: r.parentEmail, parentPhone: r.parentPhone, players: [], programs: [], refs: [], firstAt: r.createdAt };
    if (player && !g.players.includes(player)) g.players.push(player);
    if (r.program && !g.programs.includes(r.program)) g.programs.push(r.program);
    g.refs.push({ table: r.table, id: r.id });
    if (!g.parentPhone && r.parentPhone) g.parentPhone = r.parentPhone;
    if (r.createdAt < g.firstAt) g.firstAt = r.createdAt;
    map.set(key, g);
  }
  return [...map.values()];
}

/** Familles inscrites sans aucune source connue (à compléter par JP), les plus récentes d'abord. */
export function familiesWithoutSource(inscriptions: AcqRecord[]): FamilyGroup[] {
  const knownFamilies = new Set(inscriptions.filter((r) => isAcquisitionSource(r.source)).map((r) => familyKey(r.parentEmail, r.parentName)));
  return groupFamilies(inscriptions.filter((r) => !knownFamilies.has(familyKey(r.parentEmail, r.parentName)))).sort((a, b) => b.firstAt.localeCompare(a.firstAt));
}

/** Pour « Aujourd'hui » : familles sans aucune source sur toute la saison (une réponse donnée sur une inscription
 *  plus ancienne compte) dont au moins une inscription payée a été créée depuis `sinceIso`. */
export function recentFamiliesWithoutSource(inscriptions: AcqRecord[], sinceIso: string): FamilyGroup[] {
  const recent = new Set(inscriptions.filter((r) => r.createdAt >= sinceIso).map((r) => familyKey(r.parentEmail, r.parentName)));
  return familiesWithoutSource(inscriptions).filter((f) => recent.has(f.key));
}

export interface BusinessFamily extends FamilyGroup {
  businessName: string;
  /** Déjà dans le suivi des commanditaires (même entreprise ou même courriel). */
  inSponsors: boolean;
}

/** Familles qui ont déclaré une entreprise (liste pour les commandites), une ligne par entreprise et
 *  par famille, les plus récentes d'abord. `sponsors` : entreprises et courriels déjà suivis. */
export function businessFamilies(records: AcqRecord[], sponsors: { companyName: string; contactEmail: string | null }[] = []): BusinessFamily[] {
  const sponsorNames = new Set(sponsors.map((s) => normalizeText(s.companyName)).filter(Boolean));
  const sponsorEmails = new Set(sponsors.map((s) => (s.contactEmail ?? "").trim().toLowerCase()).filter(Boolean));
  const withBusiness = records.filter((r) => r.hasBusiness && (r.businessName ?? "").trim());
  const byBusiness = new Map<string, AcqRecord[]>();
  for (const r of withBusiness) {
    const k = `${familyKey(r.parentEmail, r.parentName)}#${normalizeText(r.businessName)}`;
    byBusiness.set(k, [...(byBusiness.get(k) ?? []), r]);
  }
  const out: BusinessFamily[] = [];
  for (const group of byBusiness.values()) {
    const [fam] = groupFamilies(group);
    const businessName = (group[0].businessName ?? "").trim();
    out.push({
      ...fam,
      businessName,
      inSponsors: sponsorNames.has(normalizeText(businessName)) || sponsorEmails.has(fam.parentEmail.trim().toLowerCase())
    });
  }
  return out.sort((a, b) => b.firstAt.localeCompare(a.firstAt));
}

export interface ReferralCodeLite {
  code: string;
  familyEmail: string | null;
  familyName: string | null;
}

export interface ReferralMention {
  record: AcqRecord;
  /** Code de référence reconnu dans la précision du parent, sinon null. */
  code: string | null;
  referrerName: string | null;
}

/** Inscriptions « Parrainage » : retrouve le code de référence (ou la famille) que le parent a écrit.
 *  Reconnaît le code exact (majuscules ignorées), le courriel de la famille, ou son nom complet. */
export function matchReferralMentions(records: AcqRecord[], codes: ReferralCodeLite[]): ReferralMention[] {
  const byCode = new Map(codes.map((c) => [c.code.trim().toUpperCase(), c]));
  const byEmail = new Map(codes.filter((c) => c.familyEmail).map((c) => [String(c.familyEmail).trim().toLowerCase(), c]));
  const byName = codes.filter((c) => normalizeText(c.familyName).length >= 5);
  return records
    .filter((r) => r.source === "parrainage")
    .map((record) => {
      const detail = (record.detail ?? "").trim();
      const tokens = detail.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
      let found = tokens.map((t) => byCode.get(t)).find(Boolean) ?? null;
      if (!found) {
        const email = detail.toLowerCase().match(/[^\s,;]+@[^\s,;]+/)?.[0];
        if (email) found = byEmail.get(email) ?? null;
      }
      if (!found) {
        const d = normalizeText(detail);
        found = byName.find((c) => d.includes(normalizeText(c.familyName))) ?? null;
      }
      return { record, code: found?.code ?? null, referrerName: found?.familyName ?? (found ? found.familyEmail : null) };
    });
}

/** Phrase-titre de la page : le canal qui amène le plus de familles. */
export function acquisitionHeadline(channels: ChannelRow[], share: KnownShare): string {
  const top = channels.find((c) => c.source && c.inscriptions > 0);
  if (!top || top.share === null) {
    return share.families ? "On ne sait pas encore d'où viennent nos familles" : "Aucune inscription payée cette saison";
  }
  const pct = Math.round(top.share * 100);
  return `${top.label} : ${pct} % des inscriptions dont la source est connue`;
}

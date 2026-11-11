import { z } from "zod";

import {
  ACQ_TABLES,
  acquisitionColumns,
  acquisitionHeadline,
  businessFamilies,
  channelBreakdown,
  familiesWithoutSource,
  isAcquisitionSource,
  knownSourceShare,
  markConversions,
  matchReferralMentions,
  normalizeText,
  recentFamiliesWithoutSource,
  type AcqRecord,
  type AcqTable,
  type AcquisitionSource,
  type BusinessFamily,
  type ChannelRow,
  type FamilyGroup,
  type KnownShare,
  type ReferralCodeLite
} from "@/lib/acquisition-core";
import { createSponsor, getSponsors } from "@/lib/sponsors-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Sources d'acquisition et entreprises des parents (Mandalart P3.8.01, P6.1.02, P3.1.04, AU05) :
 *  enregistrement depuis les formulaires publics, statistiques de /admin/acquisition, indicateur
 *  `source_connue` et lignes de « Aujourd'hui ». Les calculs purs sont dans `acquisition-core.ts`. */

function db() {
  return getSupabaseAdminClient() as any;
}

async function rows(query: PromiseLike<{ data: any[] | null; error: { message: string } | null }>): Promise<any[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/* ════════════════════════════════════════════════════════════
   Formulaires publics : schéma et enregistrement
   ════════════════════════════════════════════════════════════ */

/** Champ `acquisition` ajouté aux schémas zod des routes d'inscription et d'essai (`schema.extend(acquisitionField)`).
 *  Facultatif côté serveur (anciens onglets encore ouverts, liens déjà envoyés) et tolérant : une valeur mal
 *  formée est ignorée au lieu de bloquer une inscription ou un paiement. Le formulaire, lui, l'exige. */
export const acquisitionField = {
  acquisition: z
    .object({
      source: z.string().max(40).optional(),
      detail: z.string().max(400).optional(),
      hasBusiness: z.boolean().nullable().optional(),
      businessName: z.string().max(300).optional()
    })
    .optional()
    .catch(undefined)
};

/** Enregistre la réponse du parent sur la ligne qui vient d'être créée. Ne lance jamais d'erreur :
 *  une inscription ou un paiement ne doit jamais échouer à cause de cette question. */
export async function saveAcquisition(table: AcqTable, id: string | null | undefined, input: unknown): Promise<boolean> {
  const columns = acquisitionColumns(input);
  if (!id || !columns) return false;
  // Seulement ce qui a été répondu : une fiche réutilisée (ex. liste d'attente) garde ses autres réponses.
  const patch: Record<string, unknown> = {};
  if (columns.acquisition_source) Object.assign(patch, { acquisition_source: columns.acquisition_source, acquisition_detail: columns.acquisition_detail });
  if (columns.has_business !== null) Object.assign(patch, { has_business: columns.has_business, business_name: columns.business_name });
  try {
    const { error } = await db().from(table).update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error(`Unable to save acquisition source (${table} ${id})`, err);
    return false;
  }
}

/* ════════════════════════════════════════════════════════════
   Chargement : toutes les inscriptions et tous les essais, même forme
   ════════════════════════════════════════════════════════════ */

const ACQ_COLS = "acquisition_source, acquisition_detail, has_business, business_name";

interface Loaded {
  activeSeason: string;
  seasonStart: string;
  /** Inscriptions payées de la saison en cours (filles de la saison active ; garçons et Sport-Études depuis son ouverture). */
  inscriptions: AcqRecord[];
  /** Essais de la saison en cours, avec leur conversion en inscription payée. */
  trials: (AcqRecord & { converted: boolean })[];
  /** Toutes les inscriptions payées (toutes saisons), pour les codes de référence. */
  allPaid: AcqRecord[];
  /** Toutes les lignes non annulées (inscriptions, essais, listes d'attente), pour les entreprises. */
  all: AcqRecord[];
  referralCodes: ReferralCodeLite[];
  programReferrals: any[];
  referralAudit: any[];
}

function record(table: AcqTable, r: any, program: string, parent: { name: string; email: string }): AcqRecord {
  return {
    table,
    id: String(r.id),
    program,
    playerFirst: String(r.player_first_name ?? "").trim(),
    playerLast: String(r.player_last_name ?? "").trim(),
    parentName: parent.name,
    parentEmail: parent.email,
    parentPhone: r.parent_phone ?? null,
    createdAt: String(r.created_at ?? ""),
    source: r.acquisition_source ?? null,
    detail: r.acquisition_detail ?? null,
    hasBusiness: r.has_business ?? null,
    businessName: r.business_name ?? null
  };
}

async function loadAcquisitionData(): Promise<Loaded> {
  const [seasons, regs, converted, boysRegs, boysTrials, seRegs, programs, codes, programReferrals, referralAudit] = await Promise.all([
    rows(db().from("seasons").select("id, is_active")),
    rows(db().from("registrations").select(`id, season_id, program_id, status, is_trial, parent_name, parent_email, parent_phone, player_first_name, player_last_name, created_at, ${ACQ_COLS}`).neq("status", "cancelled").limit(5000)),
    rows(db().from("audit_log").select("entity_id").eq("action", "trial_converted").limit(5000)),
    rows(db().from("session_program_registrations").select(`id, program_slug, status, parent_name, parent_email, parent_phone, player_first_name, player_last_name, created_at, ${ACQ_COLS}`).neq("status", "cancelled").limit(5000)),
    rows(db().from("boys_trials").select(`id, program_slug, status, parent_name, parent_email, parent_phone, player_first_name, player_last_name, created_at, ${ACQ_COLS}`).neq("status", "cancelled").limit(5000)),
    rows(db().from("sport_etudes_registrations").select(`id, option_chosen, status, parent_first_name, parent_last_name, parent_email, parent_phone, player_first_name, player_last_name, created_at, ${ACQ_COLS}`).neq("status", "cancelled").limit(5000)),
    rows(db().from("session_programs").select("slug, name")),
    rows(db().from("referral_codes").select("code, family_email, family_name").limit(5000)),
    rows(db().from("program_referrals").select("id, registration_id, program_slug, referrer_code, referrer_email, referrer_name, match_method, status, reward_status, created_at, reg:session_program_registrations(status)").limit(5000)),
    rows(db().from("referral_audit").select("action, created_at").limit(5000))
  ]);

  const activeSeason: string = seasons.find((s: any) => s.is_active)?.id ?? "automne-hiver-2026";
  const seasonRows = regs.filter((r: any) => r.season_id === activeSeason);
  const seasonStart =
    seasonRows.map((r: any) => String(r.created_at)).sort()[0] ?? `${new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }).slice(0, 4)}-01-01`;
  const inSeason = (createdAt: string) => createdAt >= seasonStart;
  const convertedIds = new Set(converted.map((c: any) => String(c.entity_id)));
  const programName = new Map<string, string>(programs.map((p: any) => [p.slug, p.name]));

  const inscriptions: AcqRecord[] = [];
  const trialsRaw: AcqRecord[] = [];
  const allPaid: AcqRecord[] = [];
  const all: AcqRecord[] = [];

  for (const r of regs) {
    const wasTrial = Boolean(r.is_trial) || convertedIds.has(String(r.id));
    const rec = record("registrations", r, r.is_trial ? "Essai filles" : `Saison filles${r.program_id ? ` · ${r.program_id}` : ""}`, { name: r.parent_name ?? "", email: r.parent_email ?? "" });
    all.push(rec);
    const paid = r.status === "paid" && !r.is_trial;
    if (paid) allPaid.push(rec);
    if (r.season_id !== activeSeason) continue;
    if (paid) inscriptions.push(rec);
    if (wasTrial) trialsRaw.push({ ...rec, program: "Essai filles" });
  }
  for (const r of boysRegs) {
    const rec = record("session_program_registrations", r, programName.get(r.program_slug) ?? r.program_slug, { name: r.parent_name ?? "", email: r.parent_email ?? "" });
    all.push(rec);
    if (r.status !== "paid") continue;
    allPaid.push(rec);
    if (inSeason(rec.createdAt)) inscriptions.push(rec);
  }
  for (const r of boysTrials) {
    const rec = record("boys_trials", r, `Essai garçons · ${programName.get(r.program_slug) ?? r.program_slug}`, { name: r.parent_name ?? "", email: r.parent_email ?? "" });
    all.push(rec);
    if (inSeason(rec.createdAt)) trialsRaw.push(rec);
  }
  for (const r of seRegs) {
    const diagnostic = r.option_chosen === "diagnostic_only";
    const rec = record("sport_etudes_registrations", r, diagnostic ? "Sport-Études · séance diagnostique" : "Sport-Études", {
      name: `${r.parent_first_name ?? ""} ${r.parent_last_name ?? ""}`.trim(),
      email: r.parent_email ?? ""
    });
    all.push(rec);
    if (!diagnostic && r.status === "paid") {
      allPaid.push(rec);
      if (inSeason(rec.createdAt)) inscriptions.push(rec);
    }
    if (diagnostic && inSeason(rec.createdAt)) trialsRaw.push(rec);
  }

  return {
    activeSeason,
    seasonStart,
    inscriptions,
    trials: markConversions(trialsRaw, allPaid),
    allPaid,
    all,
    referralCodes: codes.map((c: any) => ({ code: String(c.code), familyEmail: c.family_email ?? null, familyName: c.family_name ?? null })),
    programReferrals,
    referralAudit
  };
}

/* ════════════════════════════════════════════════════════════
   Statistiques de /admin/acquisition
   ════════════════════════════════════════════════════════════ */

export interface ReferralStats {
  /** Codes de référence distribués aux familles. */
  codesTotal: number;
  /** Codes qui ont amené au moins une inscription (programmes garçons ou mention dans le formulaire). */
  codesUsed: number;
  /** Inscriptions payées venues d'un code de référence (sans double compte). */
  inscriptionsFromCodes: number;
  /** Dont : recommandations validées dans les programmes garçons (rabais de référencement). */
  fromProgramReferrals: number;
  /** Dont : code (ou famille) écrit dans « Parrainage » du formulaire. */
  fromFormMentions: number;
  /** Recommandations encore à vérifier par JP (/admin/references). */
  toVerify: number;
  /** Récompenses données aux familles qui recommandent (sac ou crédit). */
  rewardsGiven: number;
  /** Inscriptions de la saison qui ont répondu « Parrainage », avec ou sans code reconnu. */
  parrainageDeclared: number;
  topReferrers: { name: string; count: number }[];
}

export interface AcquisitionStats {
  activeSeason: string;
  seasonStart: string;
  headline: string;
  share: KnownShare;
  channels: ChannelRow[];
  inscriptionsCount: number;
  trialsCount: number;
  convertedTrials: number;
  /** Essais de la saison dont la source est connue. */
  trialsWithSource: number;
  businesses: BusinessFamily[];
  withoutSource: FamilyGroup[];
  referrals: ReferralStats;
}

function referralStats(data: Loaded): ReferralStats {
  const validStatus = new Set(["confirme", "valide"]);
  const fromProgram = data.programReferrals.filter((r: any) => r.reg?.status === "paid" && validStatus.has(r.status));
  const mentions = matchReferralMentions(data.allPaid, data.referralCodes).filter((m) => m.code);
  const keys = new Set<string>([
    ...fromProgram.map((r: any) => `session_program_registrations:${r.registration_id}`),
    ...mentions.map((m) => `${m.record.table}:${m.record.id}`)
  ]);
  const codesUsed = new Set<string>([
    ...fromProgram.map((r: any) => String(r.referrer_code ?? "").toUpperCase()).filter(Boolean),
    ...mentions.map((m) => String(m.code).toUpperCase())
  ]);

  const byReferrer = new Map<string, { name: string; count: number }>();
  const codeName = new Map(data.referralCodes.map((c) => [c.code.toUpperCase(), c.familyName || c.familyEmail || c.code]));
  for (const r of fromProgram) {
    const code = String(r.referrer_code ?? "").toUpperCase();
    const name = r.referrer_name || codeName.get(code) || r.referrer_email || "Famille";
    const k = normalizeText(name);
    byReferrer.set(k, { name, count: (byReferrer.get(k)?.count ?? 0) + 1 });
  }
  for (const m of mentions) {
    const name = m.referrerName || String(m.code);
    const k = normalizeText(name);
    byReferrer.set(k, { name, count: (byReferrer.get(k)?.count ?? 0) + 1 });
  }

  const rewardStatuses = new Set(["sac_a_remettre", "sac_remis", "credit_accorde"]);
  const rewardsFromRefs = data.programReferrals.filter((r: any) => rewardStatuses.has(r.reward_status)).length;
  const rewardsFromAudit = data.referralAudit.filter((a: any) => a.action === "recompense_sac" || a.action === "recompense_credit").length;

  return {
    codesTotal: data.referralCodes.length,
    codesUsed: codesUsed.size,
    inscriptionsFromCodes: keys.size,
    fromProgramReferrals: fromProgram.length,
    fromFormMentions: mentions.length,
    toVerify: data.programReferrals.filter((r: any) => r.status === "a_verifier").length,
    rewardsGiven: Math.max(rewardsFromRefs, rewardsFromAudit),
    parrainageDeclared: data.inscriptions.filter((r) => r.source === "parrainage").length,
    topReferrers: [...byReferrer.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr")).slice(0, 5)
  };
}

export async function getAcquisitionStats(): Promise<AcquisitionStats> {
  const [data, sponsors] = await Promise.all([loadAcquisitionData(), getSponsors().catch(() => [])]);
  const share = knownSourceShare(data.inscriptions);
  const channels = channelBreakdown(data.inscriptions, data.trials);
  return {
    activeSeason: data.activeSeason,
    seasonStart: data.seasonStart,
    headline: acquisitionHeadline(channels, share),
    share,
    channels,
    inscriptionsCount: data.inscriptions.length,
    trialsCount: data.trials.length,
    convertedTrials: data.trials.filter((t) => t.converted).length,
    trialsWithSource: data.trials.filter((t) => isAcquisitionSource(t.source)).length,
    businesses: businessFamilies(data.all, sponsors.map((s) => ({ companyName: s.company_name, contactEmail: s.contact_email }))),
    withoutSource: familiesWithoutSource(data.inscriptions),
    referrals: referralStats(data)
  };
}

/** Indicateur Mandalart `source_connue` (en %) : familles inscrites cette saison qui ont répondu
 *  « Comment nous avez-vous connus ? ». */
export async function getSourceConnueKpi(): Promise<{ value: number | null; note: string }> {
  const data = await loadAcquisitionData();
  const share = knownSourceShare(data.inscriptions);
  return {
    value: share.pct,
    note: `${share.known} sur ${share.families} famille${share.families > 1 ? "s" : ""} inscrite${share.families > 1 ? "s" : ""} cette saison (filles, garçons, Sport-Études) ${share.known > 1 ? "ont" : "a"} une source connue (/admin/acquisition).`
  };
}

/* ════════════════════════════════════════════════════════════
   « Aujourd'hui » : entreprises à approcher, inscriptions sans source
   ════════════════════════════════════════════════════════════ */

export interface AcquisitionTodayItem {
  title: string;
  detail?: string | null;
  meta?: string | null;
  href?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Familles qui ont déclaré une entreprise dans les 30 derniers jours et qui ne sont pas encore dans
 *  le suivi des commanditaires, puis inscriptions payées des 14 derniers jours sans source. */
export async function getAcquisitionToday(now = new Date()): Promise<{ items: AcquisitionTodayItem[]; businesses: number; missingSource: number }> {
  const [data, sponsors] = await Promise.all([loadAcquisitionData(), getSponsors().catch(() => [])]);
  const since30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const since14 = new Date(now.getTime() - 14 * DAY_MS).toISOString();
  const fresh = businessFamilies(
    data.all.filter((r) => r.createdAt >= since30),
    sponsors.map((s) => ({ companyName: s.company_name, contactEmail: s.contact_email }))
  ).filter((b) => !b.inSponsors);
  const missing = recentFamiliesWithoutSource(data.inscriptions, since14);
  const items: AcquisitionTodayItem[] = [
    ...fresh.map((b) => ({
      title: `Commandite possible : ${b.businessName}`,
      detail: `${b.parentName || b.parentEmail}${b.players.length ? ` · parent de ${b.players.join(", ")}` : ""}`,
      meta: "Ajouter aux commanditaires à approcher",
      href: "/admin/acquisition#entreprises"
    })),
    ...(missing.length
      ? [
          {
            title: `${missing.length} famille${missing.length > 1 ? "s" : ""} inscrite${missing.length > 1 ? "s" : ""} sans source`,
            detail: missing.slice(0, 3).map((f) => f.parentName || f.parentEmail).join(", ") + (missing.length > 3 ? "…" : ""),
            meta: "Choisir d'où elles viennent",
            href: "/admin/acquisition#sans-source"
          }
        ]
      : [])
  ];
  return { items, businesses: fresh.length, missingSource: missing.length };
}

/* ════════════════════════════════════════════════════════════
   Actions de l'admin
   ════════════════════════════════════════════════════════════ */

/** JP indique d'où vient une famille déjà inscrite : la source est posée sur ses inscriptions qui n'en
 *  ont pas encore (jamais d'écrasement d'une réponse du parent). Retourne le nombre de lignes mises à jour. */
export async function setFamilySource(input: { refs: { table: AcqTable; id: string }[]; source: AcquisitionSource; detail?: string | null }): Promise<number> {
  if (!isAcquisitionSource(input.source)) throw new Error("Source inconnue.");
  const detail = (input.detail ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null;
  let updated = 0;
  for (const table of ACQ_TABLES) {
    const ids = input.refs.filter((r) => r.table === table).map((r) => r.id);
    if (!ids.length) continue;
    const { data, error } = await db()
      .from(table)
      .update({ acquisition_source: input.source, acquisition_detail: detail })
      .in("id", ids)
      .is("acquisition_source", null)
      .select("id");
    if (error) throw new Error(error.message);
    updated += (data ?? []).length;
  }
  return updated;
}

/** Ajoute l'entreprise d'une famille au suivi des commanditaires (statut « Prospect »). */
export async function addBusinessToSponsors(input: { businessName: string; parentName: string; parentEmail: string; parentPhone?: string | null; players: string[] }): Promise<string> {
  const name = input.businessName.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Le nom de l'entreprise est requis.");
  const sponsors = await getSponsors();
  if (sponsors.some((s) => normalizeText(s.company_name) === normalizeText(name))) throw new Error(`${name} est déjà dans le suivi des commanditaires.`);
  const today = new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" });
  return createSponsor({
    companyName: name,
    contactName: input.parentName || null,
    contactEmail: input.parentEmail || null,
    contactPhone: input.parentPhone || null,
    status: "prospect",
    notes: `Famille New Valkyria${input.players.length ? ` (parent de ${input.players.join(", ")})` : ""} : entreprise déclarée à l'inscription. Ajoutée depuis « D'où viennent nos familles » le ${today}.`
  });
}

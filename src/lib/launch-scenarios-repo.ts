import { CLUB_ID } from "@/lib/club";
import {
  averageSessionHours,
  computeLaunch,
  normalizeInputs,
  selectLaunchAlerts,
  venueHourlyCents,
  type CoachRateSource,
  type LaunchAlert,
  type LaunchInputs,
  type LaunchResults,
  type PrefillSources,
  type ProgramSource,
  type Verdict,
  type VenueSource
} from "@/lib/launch-calculator";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Scénarios du calculateur de lancement (table launch_scenarios) et sources de préremplissage :
 *  programmes de la saison filles (programs, places de program_categories, durée des plages time_slot_templates), programmes à dates
 *  fixes (session_programs + session_program_dates), contrats de terrains (venue_rentals) et taux
 *  des éducateurs (coach_type_rates). Lecture seule sur toutes ces tables ; seules les préventes
 *  sont comptées (nombre d'inscriptions payées, aucune donnée personnelle). */

function db() {
  return getSupabaseAdminClient() as any;
}

export const torontoToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

export type SourceKind = "saison" | "session";

export interface LaunchScenario {
  id: string;
  name: string;
  sourceKind: SourceKind | null;
  sourceId: string | null;
  startDate: string | null;
  inputs: LaunchInputs;
  results: LaunchResults;
  verdict: Verdict;
  margin70: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Les résultats sont toujours recalculés à partir des entrées enregistrées, avec la date du jour : la comparaison suit
 *  les formules actuelles et la règle des préventes (2 semaines avant le début) s'applique le bon jour. */
function toScenario(row: any, today = torontoToday()): LaunchScenario {
  const inputs = normalizeInputs(row.inputs);
  const results = computeLaunch(inputs, today);
  return {
    id: row.id,
    name: row.name,
    sourceKind: row.source_kind === "saison" || row.source_kind === "session" ? row.source_kind : null,
    sourceId: row.source_id ?? null,
    startDate: row.start_date ? String(row.start_date).slice(0, 10) : null,
    inputs,
    results,
    verdict: results.verdict,
    margin70: results.margin70,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listScenarios(limit = 100, today = torontoToday()): Promise<LaunchScenario[]> {
  const { data, error } = await db().from("launch_scenarios").select("*").eq("club_id", CLUB_ID).order("updated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => toScenario(row, today));
}

export interface SaveScenarioInput {
  id?: string | null;
  name: string;
  sourceKind: SourceKind | null;
  sourceId: string | null;
  inputs: Partial<LaunchInputs>;
}

/** Enregistre (ou met à jour) un scénario. Les résultats sont toujours recalculés ici, jamais repris du navigateur.
 *  null = le scénario à mettre à jour n'existe plus (supprimé dans un autre onglet). */
export async function saveScenario(input: SaveScenarioInput): Promise<LaunchScenario | null> {
  const inputs = normalizeInputs(input.inputs);
  const results = computeLaunch(inputs, torontoToday());
  const row = {
    club_id: CLUB_ID,
    name: input.name.trim().slice(0, 120),
    source_kind: input.sourceKind && input.sourceId ? input.sourceKind : null,
    source_id: input.sourceKind && input.sourceId ? input.sourceId : null,
    start_date: inputs.startDate,
    inputs,
    results,
    verdict: results.verdict,
    margin_at_70: results.margin70 === null ? null : Math.round(results.margin70 * 10_000) / 10_000,
    updated_at: new Date().toISOString()
  };
  const query = input.id
    ? db().from("launch_scenarios").update(row).eq("id", input.id).eq("club_id", CLUB_ID).select("*").maybeSingle()
    : db().from("launch_scenarios").insert(row).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ? toScenario(data) : null;
}

export async function deleteScenario(id: string): Promise<void> {
  const { error } = await db().from("launch_scenarios").delete().eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}

// ── Préventes (nombre d'inscriptions payées par programme) ──────

async function presalesCounts(): Promise<{ saison: Map<string, number>; session: Map<string, number> }> {
  const [regs, sessionRegs] = await Promise.all([
    db().from("registrations").select("season_id, program_id").eq("status", "paid").eq("is_trial", false),
    db().from("session_program_registrations").select("program_slug").in("status", ["confirmed", "paid"])
  ]);
  const saison = new Map<string, number>();
  for (const r of regs.data ?? []) {
    if (!r.program_id) continue;
    const key = `${r.season_id}:${r.program_id}`;
    saison.set(key, (saison.get(key) ?? 0) + 1);
  }
  const session = new Map<string, number>();
  for (const r of sessionRegs.data ?? []) session.set(r.program_slug, (session.get(r.program_slug) ?? 0) + 1);
  return { saison, session };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** « 20 » → 20 ; « — » ou vide → 0 (colonnes texte tech_count, team_count, solo_count). */
const countOf = (x: unknown) => {
  const n = parseInt(String(x ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const dollarsShort = (c: number) => `${(c / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $`;

/** Tout ce qui sert à préremplir le calculateur. Chaque bloc est indépendant : une table vide ou
 *  indisponible donne une liste vide, jamais une page en erreur. */
export async function getPrefillSources(): Promise<PrefillSources> {
  const safe = async <T,>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> => {
    try {
      const { data, error } = await p;
      return error ? [] : (data ?? []);
    } catch {
      return [];
    }
  };
  const [seasons, programs, categories, slots, sessionPrograms, sessionDates, venues, rates, coaches, counts] = await Promise.all([
    safe<any>(db().from("seasons").select("id, label, starts_on, is_active")),
    safe<any>(db().from("programs").select("season_id, id, name, price_cents, tech_count, team_count, solo_count, active, display_order").eq("active", true).order("display_order")),
    safe<any>(db().from("program_categories").select("season_id, program_id, max_places")),
    safe<any>(db().from("time_slot_templates").select("season_id, start_time, end_time, active").eq("active", true)),
    safe<any>(
      db()
        .from("session_programs")
        .select("slug, name, price_cents, max_capacity, active, is_private, published, practices_count, matches_count, cost_per_session_cents, fixed_costs_cents, created_at")
        .eq("active", true)
        .order("created_at")
    ),
    safe<any>(db().from("session_program_dates").select("program_slug, session_date, start_time, end_time")),
    safe<any>(db().from("venue_rentals").select("id, season_key, venue, space, period, hours, total_cents, tax_included").order("season_key", { ascending: false })),
    safe<any>(db().from("coach_type_rates").select("coach_id, activity_type, hourly_rate_cents")),
    safe<any>(db().from("coaches").select("id, first_name, status, default_hourly_rate_cents")),
    presalesCounts().catch(() => ({ saison: new Map<string, number>(), session: new Map<string, number>() }))
  ]);

  const seasonById = new Map<string, any>(seasons.map((s: any) => [s.id, s]));
  const placesByProgram = new Map<string, number>();
  for (const c of categories) {
    const key = `${c.season_id}:${c.program_id}`;
    placesByProgram.set(key, (placesByProgram.get(key) ?? 0) + (Number(c.max_places) || 0));
  }

  // Durée moyenne des plages de chaque saison (les pratiques techniques s'y donnent).
  const slotsBySeason = new Map<string, { start: string | null; end: string | null }[]>();
  for (const t of slots) slotsBySeason.set(t.season_id, [...(slotsBySeason.get(t.season_id) ?? []), { start: t.start_time, end: t.end_time }]);

  const seasonSources: ProgramSource[] = programs
    .slice()
    .sort((a: any, b: any) => Number(seasonById.get(b.season_id)?.is_active ?? false) - Number(seasonById.get(a.season_id)?.is_active ?? false))
    .map((p: any) => {
      const key = `${p.season_id}:${p.id}`;
      const season = seasonById.get(p.season_id);
      const capacity = placesByProgram.get(key) ?? null;
      const tech = countOf(p.tech_count);
      const team = countOf(p.team_count);
      const solo = countOf(p.solo_count);
      const sessions = tech + team || null;
      const hoursPerSession = averageSessionHours(slotsBySeason.get(p.season_id) ?? []);
      const parts = [tech ? `${tech} pratiques techniques` : null, team ? `${team} pratiques d'équipe` : null].filter(Boolean).join(" + ");
      const note = [
        capacity === null ? "Places de ce programme non définies : entrez-les." : null,
        parts ? `Séances : ${parts}${hoursPerSession ? ` (durée moyenne des plages : ${String(hoursPerSession).replace(".", ",")} h)` : ""}.` : "Entrez les séances du programme.",
        solo ? `Les ${solo} séances individuelles se comptent à part (« Autres » par participante).` : null,
        "Le groupe partage le terrain avec d'autres : comptez seulement sa part des heures."
      ]
        .filter(Boolean)
        .join(" ");
      return {
        kind: "saison" as const,
        id: `${p.season_id}:${p.id}`,
        key: `saison:${key}`,
        label: p.name,
        group: `Saison filles · ${season?.label?.replace(/^Saison\s+/i, "") ?? p.season_id}`,
        priceCents: Number(p.price_cents) || 0,
        capacity,
        sessions,
        hoursPerSession,
        presales: counts.saison.get(key) ?? 0,
        otherFixedCents: 0,
        startDate: season?.starts_on ? String(season.starts_on).slice(0, 10) : null,
        note
      };
    });

  const datesBySlug = new Map<string, any[]>();
  for (const d of sessionDates) datesBySlug.set(d.program_slug, [...(datesBySlug.get(d.program_slug) ?? []), d]);
  const sessionSources: ProgramSource[] = sessionPrograms.map((p: any) => {
    const dates = (datesBySlug.get(p.slug) ?? []).slice().sort((a: any, b: any) => String(a.session_date).localeCompare(String(b.session_date)));
    const fromCounts = (Number(p.practices_count) || 0) + (Number(p.matches_count) || 0);
    const sessions = dates.length || fromCounts || null;
    const perSession = Number(p.cost_per_session_cents) || 0;
    // Même calcul que le bilan de Garçons privés (getFinancialSummary) : séances au calendrier, sinon pratiques prévues.
    const otherFixedCents = (Number(p.fixed_costs_cents) || 0) + perSession * (dates.length || Number(p.practices_count) || 0);
    const flags = [p.is_private ? "privé" : null, p.published === false ? "non publié" : null].filter(Boolean).join(", ");
    const matchesNote = dates.length && Number(p.matches_count) ? ` (+ ${p.matches_count} match${Number(p.matches_count) > 1 ? "s" : ""} hors calendrier)` : "";
    return {
      kind: "session" as const,
      id: p.slug,
      key: `session:${p.slug}`,
      label: flags ? `${p.name} (${flags})` : p.name,
      group: "Programmes à dates fixes",
      priceCents: Number(p.price_cents) || 0,
      capacity: Number(p.max_capacity) || null,
      sessions,
      hoursPerSession: averageSessionHours(dates.map((d: any) => ({ start: d.start_time, end: d.end_time }))),
      presales: counts.session.get(p.slug) ?? 0,
      otherFixedCents,
      startDate: dates[0]?.session_date ? String(dates[0].session_date).slice(0, 10) : null,
      note: [
        dates.length ? `${dates.length} séance${dates.length > 1 ? "s" : ""} au calendrier${matchesNote}.` : null,
        otherFixedCents > 0
          ? `Coûts déjà saisis dans Garçons privés : ${dollarsShort(otherFixedCents)}, mis dans « Autres coûts fixes ». S'ils comprennent déjà le terrain ou les éducateurs, ne les ajoutez pas une 2e fois.`
          : "Ajoutez le terrain et les éducateurs."
      ]
        .filter(Boolean)
        .join(" ")
    };
  });

  const venueSources: VenueSource[] = venues
    .map((v: any) => {
      const hours = Number(v.hours) || 0;
      const totalCents = Number(v.total_cents) || 0;
      return {
        id: v.id,
        label: `${v.venue}${v.space ? ` · ${v.space}` : ""}`,
        period: v.period ?? "",
        hours,
        totalCents,
        hourlyCents: venueHourlyCents(totalCents, hours),
        taxIncluded: Boolean(v.tax_included)
      };
    })
    .filter((v: VenueSource) => v.totalCents > 0);

  const coachById = new Map<string, any>(coaches.map((c: any) => [c.id, c]));
  const seen = new Set<string>();
  const coachRates: CoachRateSource[] = [];
  for (const r of rates) {
    const coach = coachById.get(r.coach_id);
    const cents = Number(r.hourly_rate_cents) || 0;
    if (!cents || (coach && coach.status && coach.status !== "active")) continue;
    const label = `${coach?.first_name ? capitalize(String(coach.first_name)) : "Éducateur"} · ${String(r.activity_type ?? "").toLowerCase() || "taux"}`;
    const key = `${label}:${cents}`;
    if (seen.has(key)) continue;
    seen.add(key);
    coachRates.push({ label, hourlyCents: cents });
  }
  // Taux de base de la fiche de chaque éducateur actif (Équipe → Entraîneurs).
  for (const c of coaches) {
    const cents = Number(c.default_hourly_rate_cents) || 0;
    if (!cents || (c.status && c.status !== "active")) continue;
    const label = `${c.first_name ? capitalize(String(c.first_name)) : "Éducateur"} · taux de base`;
    const key = `${label}:${cents}`;
    if (seen.has(key)) continue;
    seen.add(key);
    coachRates.push({ label, hourlyCents: cents });
  }
  coachRates.sort((a, b) => a.hourlyCents - b.hourlyCents);

  return { programs: [...seasonSources, ...sessionSources], venues: venueSources, coachRates };
}

// ── Alerte des préventes (2 semaines avant le début) ────────────

export type { LaunchAlert };

/** Lancements qui commencent dans 14 jours ou moins et dont les préventes n'atteignent pas le seuil de survie
 *  (règles pures : selectLaunchAlerts). Pour un scénario relié à un programme, les préventes sont comptées en direct ;
 *  sinon, la valeur saisie. Seul le scénario le plus récent de chaque programme compte. */
export async function getLaunchAlerts(today = torontoToday()): Promise<LaunchAlert[]> {
  const { data, error } = await db()
    .from("launch_scenarios")
    .select("id, name, source_kind, source_id, start_date, inputs, updated_at")
    .eq("club_id", CLUB_ID)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  if (!rows.length) return [];
  const sourceKey = (r: any) => (r.source_kind && r.source_id ? `${r.source_kind}:${r.source_id}` : null);
  const counts = rows.some((r) => sourceKey(r)) ? await presalesCounts() : null;
  const live = (key: string): number | null => {
    if (!counts) return null;
    const [kind, ...rest] = key.split(":");
    const id = rest.join(":");
    return (kind === "saison" ? counts.saison.get(id) : counts.session.get(id)) ?? 0;
  };
  return selectLaunchAlerts(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceKey: sourceKey(r),
      startDate: r.start_date ? String(r.start_date).slice(0, 10) : null,
      updatedAt: String(r.updated_at ?? ""),
      inputs: normalizeInputs(r.inputs)
    })),
    live,
    today
  );
}

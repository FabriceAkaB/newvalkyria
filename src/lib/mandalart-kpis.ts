import { CLUB_ID } from "@/lib/club";
import { getBank } from "@/lib/exercises-repo";
import { getFeedbackWeeks } from "@/lib/coach-portal-repo";
import { kpiProgress, parseKpiNumber, type ParsedNumber } from "@/lib/mandalart-core";
import { PLAN, type PlanKpi } from "@/lib/mandalart-plan";
import { computeRevenueSummary } from "@/lib/revenue-calc";
import { getSurveyKpis } from "@/lib/surveys-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Indicateurs du Mandalart reliés aux vraies tables du site. Chaque calcul est décrit ici ;
 *  un indicateur sans calcul automatique (ou pas encore branché) prend la dernière valeur
 *  saisie à la main dans /admin/mandalart/indicateurs. Montants en dollars, taux en %. */

function db() {
  return getSupabaseAdminClient() as any;
}

async function rows(q: any): Promise<any[]> {
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export interface AutoValue {
  value: number | null;
  note: string;
}

export interface CohortRow {
  year: number;
  label: string;
  players: number;
  target: number | null;
  missing: number | null;
}

export interface RealFigures {
  auto: Record<string, AutoValue>;
  cohorts: CohortRow[];
  retention: { previousFamilies: number; returned: number; lost: { name: string; email: string }[] };
  monthsCents: Record<string, number>;
  activeSeason: string;
}

const GENERATION_TARGET = 40; // environ 40 joueuses par génération (indicateur cohortes_2017_2019)

/** Calcule tous les indicateurs automatiques à partir des vraies données. */
export async function computeRealFigures(today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })): Promise<RealFigures> {
  const year = today.slice(0, 4);
  const [seasons, regs, leads, slots, sponsorSlots, matchBookings, bank, exerciseBlocks] = await Promise.all([
    rows(db().from("seasons").select("id, is_active")),
    rows(db().from("registrations").select("season_id, status, is_trial, parent_email, player_first_name, player_last_name, player_dob, time_slot_template_id, created_at")),
    rows(db().from("leads").select("status, email, parent_name, created_at")),
    rows(db().from("time_slot_templates").select("id, max_places, active")),
    rows(db().from("sponsor_slots_2027").select("status, price_cents")),
    rows(db().from("match_slot_bookings").select("status")),
    getBank().catch(() => ({ entries: [], ratings: [] })),
    rows(db().from("activity_session_blocks").select("activity_id, exercise_id, activity:coach_activities(activity_date)").not("exercise_id", "is", null))
  ]);
  const activeSeason = seasons.find((s: any) => s.is_active)?.id ?? "automne-hiver-2026";
  const paid = regs.filter((r: any) => r.season_id === activeSeason && r.status === "paid");
  const auto: Record<string, AutoValue> = {};

  // ca_annee, ca_12m : encaissements du module Revenus (mêmes chiffres que /admin/revenus)
  const monthsCents: Record<string, number> = {};
  try {
    const summary = await computeRevenueSummary();
    for (const m of summary.months) monthsCents[m.month] = (monthsCents[m.month] ?? 0) + m.revenueCents;
    const ym = today.slice(0, 7);
    const [y, mo] = ym.split("-").map(Number);
    const start12 = `${mo === 12 ? y : y - 1}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}`;
    const yearCents = Object.entries(monthsCents).filter(([m]) => m.startsWith(year) && m <= ym).reduce((s, [, c]) => s + c, 0);
    const rollingCents = Object.entries(monthsCents).filter(([m]) => m >= start12 && m <= ym).reduce((s, [, c]) => s + c, 0);
    auto.ca_annee = { value: yearCents / 100, note: `Encaissements du 1er janvier ${year} à aujourd'hui (module Revenus).` };
    auto.ca_12m = { value: rollingCents / 100, note: "Encaissements des 12 derniers mois (module Revenus)." };
    auto.ca_valkyria_annee = { value: yearCents / 100, note: "Pour l'instant identique au CA de l'année : les revenus garçons et conseil ne sont pas encore séparés." };
  } catch {
    auto.ca_annee = { value: null, note: "Module Revenus indisponible." };
  }

  // membres_actifs : inscriptions filles payées de la saison en cours
  auto.membres_actifs = { value: paid.length, note: `Inscriptions payées, saison ${activeSeason}.` };

  // cohortes : joueuses par année de naissance
  const byYear = new Map<number, number>();
  for (const r of paid) {
    const y = r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : NaN;
    if (Number.isFinite(y) && y > 2005 && y < Number(year) - 3) byYear.set(y, (byYear.get(y) ?? 0) + 1);
  }
  const cohorts: CohortRow[] = [];
  for (let y = 2013; y <= 2019; y++) {
    const players = byYear.get(y) ?? 0;
    const target = y >= 2015 ? GENERATION_TARGET : null;
    cohorts.push({ year: y, label: `Nées en ${y}`, players, target, missing: target === null ? null : Math.max(0, target - players) });
  }
  const young = cohorts.filter((c) => c.year >= 2017).reduce((s, c) => s + c.players, 0);
  auto.cohortes_2017_2019 = { value: young, note: cohorts.filter((c) => c.year >= 2017).map((c) => `${c.year} : ${c.players}`).join(" · ") };

  // retour_saison : familles de l'été (leads payés) réinscrites cette saison (même courriel)
  const summer = new Map<string, string>();
  for (const l of leads.filter((x: any) => x.status === "paid")) {
    const e = norm(l.email);
    if (e) summer.set(e, l.parent_name ?? e);
  }
  const fallEmails = new Set(paid.map((r: any) => norm(r.parent_email)));
  const lost = [...summer.entries()].filter(([e]) => !fallEmails.has(e)).map(([email, name]) => ({ email, name }));
  const returned = summer.size - lost.length;
  auto.retour_saison = { value: summer.size ? Math.round((returned / summer.size) * 1000) / 10 : null, note: `${returned} familles sur ${summer.size}, de l'été à la saison en cours.` };

  // remplissage : inscrites ÷ places de tous les créneaux filles actifs
  const active = slots.filter((s: any) => s.active);
  const cap = active.reduce((s: number, x: any) => s + (x.max_places ?? 0), 0);
  const taken = active.reduce((s: number, x: any) => s + paid.filter((r: any) => r.time_slot_template_id === x.id).length, 0);
  auto.remplissage = { value: cap ? Math.round((taken / cap) * 1000) / 10 : null, note: `${taken} places sur ${cap}.` };

  // nouvelles_joueuses_an : joueuses dont la première inscription payée est cette année
  const firstSeen = new Map<string, string>();
  for (const r of regs.filter((x: any) => x.status === "paid")) {
    const k = `${norm(r.player_first_name)}|${norm(r.player_last_name)}`;
    const d = String(r.created_at).slice(0, 10);
    if (!firstSeen.has(k) || d < firstSeen.get(k)!) firstSeen.set(k, d);
  }
  const newThisYear = [...firstSeen.values()].filter((d) => d.startsWith(year)).length;
  auto.nouvelles_joueuses_an = { value: newThisYear, note: `Joueuses dont la première inscription payée date de ${year} (saison filles).` };

  // commandites_annee : emplacements de commandite 2027 vendus
  const sold = sponsorSlots.filter((s: any) => s.status === "sold");
  auto.commandites_annee = { value: sold.reduce((s: number, x: any) => s + (x.price_cents ?? 0), 0) / 100, note: `${sold.length} emplacements vendus (module Commandites 2027).` };

  // plages_matchs : réservations payées (module Vente de matchs)
  auto.plages_matchs = { value: matchBookings.filter((b: any) => b.status === "paid").length, note: "Réservations payées (module Vente de matchs)." };

  // exercices_approuves : statut calculé de la banque (2 éducateurs à 8/10 ou plus + validation de JP), par génération U8 à U12
  const approved = bank.entries.filter((e) => e.bank.status === "approuve");
  const byAge = ["U8", "U9", "U10", "U11", "U12"].map((a) => `${a} ${approved.filter((e) => (e.age_groups ?? []).includes(a)).length}`).join(" · ");
  const toValidate = bank.entries.filter((e) => e.bank.status === "a-valider").length;
  auto.exercices_approuves = {
    value: approved.length,
    note: `${approved.length} approuvé(s) sur ${bank.entries.length} dans la banque (${byAge}) ; ${toValidate} à valider par JP ; ${bank.ratings.length} note(s) d'éducateurs (/admin/exercices).`
  };

  // seances_approuvees : séances passées dont tous les exercices de la banque sont approuvés
  const statusById = new Map(bank.entries.map((e) => [e.id, e.bank.status]));
  const sessions = new Map<string, boolean>();
  for (const b of exerciseBlocks) {
    const date = String(b.activity?.activity_date ?? "");
    if (!date || date > today) continue;
    sessions.set(b.activity_id, (sessions.get(b.activity_id) ?? true) && statusById.get(b.exercise_id) === "approuve");
  }
  if (sessions.size) {
    const ok = [...sessions.values()].filter(Boolean).length;
    auto.seances_approuvees = { value: Math.round((ok / sessions.size) * 100), note: `${ok} séance(s) sur ${sessions.size} bâties seulement avec des exercices approuvés.` };
  }

  // appreciation_joueuses : routine de fin du portail entraîneur (note de la pratique sur 10 donnée par chaque
  // joueuse) ; la semaine la plus récente qui a des notes, et les précédentes dans la note.
  try {
    const weeks = (await getFeedbackWeeks()).filter((w) => w.rating !== null);
    if (weeks.length) {
      const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
      const fr = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-CA"));
      auto.appreciation_joueuses = {
        value: weeks[0].rating,
        note: weeks
          .slice(0, 4)
          .map((w) => `Semaine du ${label(w.weekStart)} : ${fr(w.rating)}/10 (${w.count} joueuse${w.count > 1 ? "s" : ""}, fatigue ${fr(w.fatigue)}/10)`)
          .join(" · ")
      };
    }
  } catch {
    /* routine de fin pas encore utilisée */
  }

  // Sondages (module Voix des familles)
  try {
    const s = await getSurveyKpis();
    if (s.responseRate !== null) auto.taux_reponse_sondages = { value: s.responseRate, note: s.responseNote };
    if (s.satisfaction !== null) auto.satisfaction = { value: s.satisfaction, note: s.satisfactionNote };
    if (s.recommend !== null) auto.recommandation = { value: s.recommend, note: s.recommendNote };
  } catch {
    /* module sondages pas encore utilisé */
  }

  return { auto, cohorts, retention: { previousFamilies: summer.size, returned, lost }, monthsCents, activeSeason };
}

export interface KpiView extends PlanKpi {
  startN: ParsedNumber;
  targetN: ParsedNumber;
  current: number | null;
  currentSource: "auto" | "manuel" | null;
  currentNote: string | null;
  measuredAt: string | null;
  progress: number | null;
  met: boolean;
  history: { date: string; value: number }[];
}

export async function computeKpis(figures?: RealFigures): Promise<KpiView[]> {
  const [{ auto }, manualRows] = await Promise.all([
    figures ?? computeRealFigures(),
    rows(db().from("mandalart_kpi_values").select("kpi_id, value, measured_at, source, note").eq("club_id", CLUB_ID).order("measured_at"))
  ]);
  return PLAN.kpis.map((k) => {
    const startN = parseKpiNumber(k.start);
    const targetN = parseKpiNumber(k.target);
    const history = manualRows.filter((r: any) => r.kpi_id === k.id).map((r: any) => ({ date: String(r.measured_at).slice(0, 10), value: Number(r.value) }));
    const lastManual = manualRows.filter((r: any) => r.kpi_id === k.id && r.source === "manuel").at(-1);
    const a = auto[k.id];
    let current: number | null = null;
    let currentSource: KpiView["currentSource"] = null;
    let currentNote: string | null = null;
    let measuredAt: string | null = null;
    if (a && a.value !== null) {
      current = a.value;
      currentSource = "auto";
      currentNote = a.note;
      measuredAt = new Date().toISOString().slice(0, 10);
    } else if (lastManual) {
      current = Number(lastManual.value);
      currentSource = "manuel";
      currentNote = lastManual.note ?? null;
      measuredAt = String(lastManual.measured_at).slice(0, 10);
    } else if (a) {
      currentNote = a.note;
    }
    const progress = kpiProgress(startN.value, targetN.value, current, targetN.lowerIsBetter);
    return { ...k, startN, targetN, current, currentSource, currentNote, measuredAt, progress, met: progress !== null && progress >= 1, history };
  });
}

export function formatKpi(value: number | null, unit: ParsedNumber["unit"]): string {
  if (value === null) return "—";
  const n = value.toLocaleString("fr-CA", { maximumFractionDigits: unit === "%" || unit === "/10" ? 1 : 0 });
  if (unit === "$") return `${n} $`;
  if (unit === "%") return `${n} %`;
  if (unit === "/10") return `${n}/10`;
  if (unit === "mois") return `${n} mois`;
  return n;
}

import { familyKey, playerKey } from "@/lib/acquisition-core";
import {
  addDays,
  channelCosts,
  goalPeriods,
  measure,
  METRICS,
  pace,
  trialsHeadline,
  weekStart,
  weeklyGoalsFor,
  type AcqEvents,
  type ChannelCost,
  type GoalPeriod,
  type Measures,
  type Metric,
  type Pace
} from "@/lib/acquisition-goals";
import { CLUB_ID } from "@/lib/club";
import { addChannelStat } from "@/lib/marketing-stats";
import { addKpiValue } from "@/lib/mandalart-repo";
import { logOutreach } from "@/lib/outreach";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildFunnel, FUNNEL_CAMPAIGN, localDay, OPEN_STAGES, STEP_DEFS, type FunnelBoard, type FunnelLog, type FunnelRow, type FunnelTable, type FunnelTrial, type TrialStep } from "@/lib/trial-funnel";

/** Objectifs d'acquisition (P3.8.20), entonnoir des essais (P3.6.10) et indicateurs Mandalart `essais_semaine`,
 *  `publications_semaine`, `prospects_semaine`. Lit les formulaires (essais filles et garçons, inscriptions,
 *  liste d'attente, Sport-Études, demandes d'information), le journal des relances, les publications et les avis
 *  Google notés. Règles pures : acquisition-goals.ts et trial-funnel.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

async function rows(query: PromiseLike<{ data: any[] | null; error: { message: string } | null }>): Promise<any[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

const day = (ts: unknown) => (ts ? localDay(String(ts)) : "");
const dateOnly = (d: unknown) => (d ? String(d).slice(0, 10) : null);
const fullName = (first: unknown, last: unknown) => `${String(first ?? "").trim()} ${String(last ?? "").trim()}`.replace(/\s+/g, " ").trim();
/** Les champs date (date sans heure) reviennent parfois en « 2026-11-02T05:00:00.000Z » : on garde le jour de Montréal. */
const dateCol = (d: unknown) => (d ? (String(d).length > 10 ? localDay(String(d)) : String(d)) : null);

/** Note manuelle de prospects (marketing_channel_stats, canal « autre ») : la note commence par ce préfixe + la source. */
const MANUAL_PREFIX = "Prospects notés à la main";

interface Loaded {
  trials: FunnelTrial[];
  logs: FunnelLog[];
  events: Omit<AcqEvents, "trials">;
}

async function load(): Promise<Loaded> {
  const [regs, converted, spRegs, boys, seRegs, leads, programs, log, reviews, posts, shoots, stats] = await Promise.all([
    rows(db().from("registrations").select("id, status, is_trial, trial_date, program_id, parent_name, parent_email, parent_phone, player_first_name, player_last_name, created_at, acquisition_source").limit(10000)),
    rows(db().from("audit_log").select("entity_id, created_at").eq("action", "trial_converted").limit(5000)),
    rows(db().from("session_program_registrations").select("id, program_slug, status, parent_name, parent_email, player_first_name, player_last_name, created_at, acquisition_source").limit(10000)),
    rows(db().from("boys_trials").select("id, program_slug, status, trial_date, parent_name, parent_email, parent_phone, player_first_name, player_last_name, created_at, acquisition_source").limit(5000)),
    rows(db().from("sport_etudes_registrations").select("id, option_chosen, status, parent_first_name, parent_last_name, parent_email, parent_phone, player_first_name, player_last_name, created_at, acquisition_source").limit(5000)),
    rows(db().from("leads").select("email, parent_name, status, created_at").limit(5000)),
    rows(db().from("session_programs").select("slug, name")),
    rows(db().from("outreach_log").select("trial_ref, trial_step, kind, sent_at, parent_email, player_name, notes").order("sent_at").limit(10000)),
    rows(db().from("mandalart_kpi_values").select("value, measured_at").eq("club_id", CLUB_ID).eq("kpi_id", "avis_google_total").order("measured_at")),
    rows(db().from("marketing_posts").select("group_id, posted_on, paid, spend_cents").eq("club_id", CLUB_ID).limit(10000)),
    rows(db().from("jp_video_shoots").select("status, publish_on, post_kind").eq("status", "publie").limit(5000)),
    rows(db().from("marketing_channel_stats").select("channel, measured_at, spend_cents, leads, note").eq("club_id", CLUB_ID).limit(10000))
  ]);
  const programName = new Map<string, string>(programs.map((p: any) => [p.slug, p.name]));
  const convertedAt = new Map<string, string>(converted.map((c: any) => [String(c.entity_id), day(c.created_at)]));

  // Inscriptions payées (tous programmes) : pour les essais convertis et les mesures.
  const paidByPlayer = new Map<string, string[]>();
  const inscriptions: AcqEvents["inscriptions"] = [];
  const clientSince = new Map<string, string>();
  const addPaid = (family: string, player: string, d: string, source: string | null) => {
    inscriptions.push({ day: d, source });
    if (player !== "|") paidByPlayer.set(player, [...(paidByPlayer.get(player) ?? []), d]);
    if (!clientSince.has(family) || d < clientSince.get(family)!) clientSince.set(family, d);
  };
  const forms: AcqEvents["forms"] = [];
  const trials: FunnelTrial[] = [];

  for (const r of regs) {
    const family = familyKey(r.parent_email, r.parent_name);
    forms.push({ family, day: day(r.created_at), source: r.acquisition_source ?? null });
    const wasTrial = Boolean(r.is_trial) || convertedAt.has(String(r.id)) || Boolean(r.trial_date);
    if (r.status === "paid" && (!r.is_trial || convertedAt.has(String(r.id)))) addPaid(family, playerKey(r.player_first_name, r.player_last_name), convertedAt.get(String(r.id)) ?? day(r.created_at), r.acquisition_source ?? null);
    if (wasTrial) {
      trials.push({
        ref: `registrations:${r.id}`,
        table: "registrations",
        id: String(r.id),
        program: "Essai filles",
        playerName: fullName(r.player_first_name, r.player_last_name),
        parentName: r.parent_name ?? "",
        parentEmail: r.parent_email ?? "",
        parentPhone: r.parent_phone ?? null,
        createdAt: String(r.created_at),
        trialDate: dateCol(r.trial_date),
        cancelled: r.status === "cancelled" || r.status === "unavailable",
        converted: r.status === "paid",
        source: r.acquisition_source ?? null
      });
    }
  }
  for (const r of spRegs) {
    const family = familyKey(r.parent_email, r.parent_name);
    forms.push({ family, day: day(r.created_at), source: r.acquisition_source ?? null });
    if (r.status === "paid") addPaid(family, playerKey(r.player_first_name, r.player_last_name), day(r.created_at), r.acquisition_source ?? null);
  }
  for (const r of seRegs) {
    const parentName = fullName(r.parent_first_name, r.parent_last_name);
    const family = familyKey(r.parent_email, parentName);
    forms.push({ family, day: day(r.created_at), source: r.acquisition_source ?? null });
    const diagnostic = r.option_chosen === "diagnostic_only";
    if (!diagnostic && r.status === "paid") addPaid(family, playerKey(r.player_first_name, r.player_last_name), day(r.created_at), r.acquisition_source ?? null);
    if (diagnostic) {
      trials.push({
        ref: `sport_etudes_registrations:${r.id}`,
        table: "sport_etudes_registrations",
        id: String(r.id),
        program: "Sport-Études · séance diagnostique",
        playerName: fullName(r.player_first_name, r.player_last_name),
        parentName,
        parentEmail: r.parent_email ?? "",
        parentPhone: r.parent_phone ?? null,
        createdAt: String(r.created_at),
        trialDate: null,
        cancelled: r.status === "cancelled",
        converted: false,
        source: r.acquisition_source ?? null
      });
    }
  }
  for (const r of boys) {
    const family = familyKey(r.parent_email, r.parent_name);
    forms.push({ family, day: day(r.created_at), source: r.acquisition_source ?? null });
    trials.push({
      ref: `boys_trials:${r.id}`,
      table: "boys_trials",
      id: String(r.id),
      program: `Essai garçons · ${programName.get(r.program_slug) ?? r.program_slug ?? ""}`.replace(/ · $/, ""),
      playerName: fullName(r.player_first_name, r.player_last_name),
      parentName: r.parent_name ?? "",
      parentEmail: r.parent_email ?? "",
      parentPhone: r.parent_phone ?? null,
      createdAt: String(r.created_at),
      trialDate: dateCol(r.trial_date),
      cancelled: r.status === "cancelled",
      converted: false,
      source: r.acquisition_source ?? null
    });
  }
  for (const l of leads) {
    const family = familyKey(l.email, l.parent_name);
    forms.push({ family, day: day(l.created_at), source: null });
    if (l.status === "paid" && (!clientSince.has(family) || day(l.created_at) < clientSince.get(family)!)) clientSince.set(family, day(l.created_at));
  }
  // Essai devenu inscription : la même joueuse a payé le jour de l'essai ou après (comme « D'où viennent nos familles »).
  for (const t of trials) {
    if (t.converted) continue;
    const [first, ...rest] = t.playerName.split(" ");
    const paidDays = paidByPlayer.get(playerKey(first, rest.join(" "))) ?? [];
    t.converted = paidDays.some((d) => d >= day(t.createdAt));
  }

  const manualProspects: AcqEvents["manualProspects"] = [];
  const spend: AcqEvents["spend"] = [];
  for (const s of stats) {
    const d = dateOnly(s.measured_at) ?? "";
    if ((s.channel === "pub_meta" || s.channel === "pub_google") && s.spend_cents) spend.push({ day: d, cents: Number(s.spend_cents) });
    if (s.channel === "autre" && s.leads && String(s.note ?? "").startsWith(MANUAL_PREFIX)) {
      const src = String(s.note).slice(MANUAL_PREFIX.length).match(/^ · ([a-z_]+)/)?.[1] ?? null;
      manualProspects.push({ day: d, source: src, count: Number(s.leads) });
    }
  }
  for (const p of posts) if (p.paid && p.spend_cents) spend.push({ day: dateOnly(p.posted_on) ?? "", cents: Number(p.spend_cents) });

  return {
    trials,
    logs: log.map((l: any) => ({ trialRef: l.trial_ref ?? null, step: l.trial_step ?? null, kind: l.kind, at: String(l.sent_at), parentEmail: l.parent_email ?? "", playerName: l.player_name ?? null, notes: l.notes ?? null })),
    events: {
      forms,
      clientSince,
      manualProspects,
      inscriptions,
      reviewTotals: reviews.map((r: any) => ({ day: dateOnly(r.measured_at) ?? "", total: Number(r.value) })),
      posts: posts.map((p: any) => ({ day: dateOnly(p.posted_on) ?? "", key: String(p.group_id ?? p.posted_on) })),
      shoots: shoots.filter((s: any) => s.publish_on).map((s: any) => ({ day: dateOnly(s.publish_on)!, trialReel: s.post_kind === "essai" })),
      spend
    }
  };
}

function eventsWithTrials(data: Loaded, board: FunnelBoard): AcqEvents {
  const stage = new Map(board.rows.map((r) => [r.ref, r]));
  return {
    ...data.events,
    trials: data.trials.map((t) => {
      const r = stage.get(t.ref);
      return { day: day(t.createdAt), trialDate: t.trialDate, cancelled: t.cancelled, absent: r?.stage === "absente" || Boolean(r?.steps.absente && t.trialDate && r.steps.absente >= t.trialDate), source: t.source };
    })
  };
}

/* ════════════════════════════════════════════════════════════
   Objectifs d'acquisition (/admin/acquisition)
   ════════════════════════════════════════════════════════════ */

export interface GoalPeriodView extends GoalPeriod {
  measures: Measures;
  paces: Record<Metric, Pace | null>;
  channels: ChannelCost[];
}

export interface AcquisitionGoals {
  today: string;
  periods: GoalPeriodView[];
  headline: string;
  lastReviewTotal: { day: string; total: number } | null;
  /** Prospects notés à la main ces 30 derniers jours. */
  manual: { day: string; source: string | null; count: number }[];
  funnel: { open: number; dueToday: number; contact24h: { within: number; total: number } };
}

export async function getAcquisitionGoals(now = new Date()): Promise<AcquisitionGoals> {
  const today = localDay(now);
  const data = await load();
  const board = buildFunnel(data.trials, data.logs, now);
  const events = eventsWithTrials(data, board);
  const periods = goalPeriods(today).map((p) => {
    const measures = measure(events, p.from, p.to, today);
    // Avant le 1er décembre, les objectifs sont montrés d'avance : pas de couleur (rien n'est en retard).
    const paces = Object.fromEntries(METRICS.map((m) => [m, p.goals && !p.preview ? pace(measures[m], p.goals[m], p.elapsed) : null])) as Record<Metric, Pace | null>;
    return { ...p, measures, paces, channels: channelCosts(events, p.from, p.to) };
  });
  const week = periods[0];
  return {
    today,
    periods,
    headline: trialsHeadline(week.measures, week.goals, "Cette semaine"),
    lastReviewTotal: events.reviewTotals.at(-1) ?? null,
    manual: events.manualProspects.filter((m) => m.day >= addDays(today, -30)).sort((a, b) => b.day.localeCompare(a.day)),
    funnel: { open: board.rows.filter((r) => OPEN_STAGES.includes(r.stage)).length, dueToday: board.today.length, contact24h: board.contact24h }
  };
}

/** Prospects d'un canal notés à la main (messages, appels, kiosque) : une ligne dans marketing_channel_stats. */
export async function addManualProspects(input: { day: string; source: string | null; count: number; note?: string | null }): Promise<void> {
  const note = `${MANUAL_PREFIX}${input.source ? ` · ${input.source}` : ""}${input.note?.trim() ? ` · ${input.note.trim().slice(0, 160)}` : ""}`;
  await addChannelStat({ channel: "autre", measuredAt: input.day, leads: input.count, note });
}

/** Total d'avis Google de la fiche, noté le lundi : indicateur avis_google_total du Mandalart. */
export async function addGoogleReviewTotal(input: { day: string; total: number }): Promise<void> {
  await addKpiValue({ kpiId: "avis_google_total", value: input.total, measuredAt: input.day, note: "Noté dans D'où viennent nos familles", source: "manuel" });
}

/* ════════════════════════════════════════════════════════════
   Entonnoir des essais (/admin/relances/essais)
   ════════════════════════════════════════════════════════════ */

export interface TrialFunnelView extends FunnelBoard {
  /** Saison filles active (lien vers la page où l'on fixe la date d'un essai). */
  seasonId: string;
}

/** Les essais des 120 derniers jours, plus ceux encore ouverts ; un résultat (inscrite, fermée, liste chaude) disparaît
 *  du tableau 45 jours après la demande. */
export async function getTrialFunnel(now = new Date()): Promise<TrialFunnelView> {
  const [data, seasons] = await Promise.all([load(), rows(db().from("seasons").select("id, is_active"))]);
  const board = buildFunnel(data.trials, data.logs, now);
  const since = now.getTime() - 120 * 86_400_000;
  const closedSince = now.getTime() - 45 * 86_400_000;
  const keep = (r: FunnelRow) => {
    const t = Date.parse(r.createdAt);
    if (t < since && !r.next) return false;
    return OPEN_STAGES.includes(r.stage) ? true : t >= closedSince || (r.trialDate !== null && Date.parse(`${r.trialDate}T12:00:00Z`) >= closedSince);
  };
  const rowsKept = board.rows.filter(keep);
  const counts = { ...board.counts };
  for (const k of Object.keys(counts) as (keyof typeof counts)[]) counts[k] = rowsKept.filter((r) => r.stage === k).length;
  return {
    rows: rowsKept,
    today: board.today.filter(keep),
    counts,
    contact24h: board.contact24h,
    seasonId: seasons.find((s: any) => s.is_active)?.id ?? "automne-hiver-2026"
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TABLES: readonly FunnelTable[] = ["registrations", "boys_trials", "sport_etudes_registrations"];

/** Note une étape faite pour un essai (bouton du tableau) : une ligne dans le journal des relances. */
export async function recordTrialStep(input: { ref: string; step: TrialStep; notes?: string | null; actor: string }): Promise<FunnelRow> {
  const [table, id] = input.ref.split(":") as [FunnelTable, string];
  if (!TABLES.includes(table) || !UUID.test(id ?? "")) throw new Error("Essai introuvable.");
  const data = await load();
  const trial = data.trials.find((t) => t.ref === input.ref);
  if (!trial) throw new Error("Essai introuvable.");
  if (!trial.parentEmail) throw new Error("Cet essai n'a pas de courriel de parent.");
  const def = STEP_DEFS[input.step];
  const notes = input.notes?.replace(/\s+/g, " ").trim().slice(0, 500) || null;
  await logOutreach({
    parentEmail: trial.parentEmail,
    parentName: trial.parentName || null,
    playerName: trial.playerName || null,
    registrationId: table === "registrations" ? id : null,
    campaign: FUNNEL_CAMPAIGN,
    subject: `${def.done} (noté par ${input.actor})`,
    kind: def.kind,
    notes,
    trialRef: trial.ref,
    trialStep: input.step
  });
  const now = new Date();
  const logs = [...data.logs, { trialRef: trial.ref, step: input.step, kind: def.kind, at: now.toISOString(), parentEmail: trial.parentEmail, playerName: trial.playerName, notes }];
  return buildFunnel([trial], logs, now).rows[0];
}

/* ════════════════════════════════════════════════════════════
   « Aujourd'hui » et indicateurs Mandalart
   ════════════════════════════════════════════════════════════ */

export interface AcquisitionTodayLine {
  title: string;
  detail?: string | null;
  meta?: string | null;
  href?: string | null;
}

/** Essais à traiter aujourd'hui (tous les jours) et, le lundi, le bilan de la semaine dernière contre ses objectifs. */
export async function getAcquisitionGoalsToday(now = new Date()): Promise<{ funnel: AcquisitionTodayLine[]; late: number; monday: AcquisitionTodayLine | null }> {
  const today = localDay(now);
  const data = await load();
  const board = buildFunnel(data.trials, data.logs, now);
  const funnel = board.today.map((r) => ({
    title: `${r.playerName || "Joueuse"} : ${r.next!.label.charAt(0).toLowerCase()}${r.next!.label.slice(1)}`,
    detail: `${r.parentName || r.parentEmail}${r.parentPhone ? ` · ${r.parentPhone}` : ""} · ${r.program}`,
    meta: r.next!.step === "contact" ? (r.next!.late ? "Demande sans réponse depuis plus de 24 h" : "Demande reçue, à contacter avant 24 h") : r.next!.late ? `En retard depuis le ${r.next!.due.slice(8)}/${r.next!.due.slice(5, 7)}` : "Aujourd'hui",
    href: "/admin/relances/essais"
  }));
  let monday: AcquisitionTodayLine | null = null;
  if (new Date(`${today}T12:00:00Z`).getUTCDay() === 1) {
    const events = eventsWithTrials(data, board);
    const last = addDays(weekStart(today), -7);
    const { goals, preview } = weeklyGoalsFor(last);
    const m = measure(events, last, addDays(last, 6), today);
    monday = {
      title: "Lundi : revoir les objectifs d'acquisition (15 minutes)",
      detail: trialsHeadline(m, preview ? null : goals, "Semaine dernière"),
      meta: `${m.posts} publication${(m.posts ?? 0) > 1 ? "s" : ""}${preview ? "" : ` sur ${goals.posts}`} · noter le total d'avis Google et les prospects reçus par message`,
      href: "/admin/acquisition#objectifs"
    };
  }
  return { funnel, late: board.today.filter((r) => r.next?.late).length, monday };
}

/** Indicateurs `essais_semaine`, `publications_semaine` et `prospects_semaine` : la dernière semaine complète (lundi au dimanche). */
export async function getAcquisitionKpis(today: string): Promise<Record<"essais_semaine" | "publications_semaine" | "prospects_semaine", { value: number; note: string }>> {
  const now = new Date(`${today}T17:00:00Z`);
  const data = await load();
  const board = buildFunnel(data.trials, data.logs, now);
  const events = eventsWithTrials(data, board);
  const last = addDays(weekStart(today), -7);
  const to = addDays(last, 6);
  const m = measure(events, last, to, today);
  const label = `semaine du ${last.slice(8)}/${last.slice(5, 7)} au ${to.slice(8)}/${to.slice(5, 7)}`;
  return {
    essais_semaine: { value: m.trialsBooked ?? 0, note: `${m.trialsBooked} essai(s) réservé(s), ${m.trialsDone} fait(s), ${m.inscriptions} inscription(s), ${label} (/admin/acquisition).` },
    publications_semaine: { value: m.posts ?? 0, note: `${m.posts} publication(s) et ${m.trialReels} reel(s) d'essai, ${label} (Réseaux sociaux et calendrier de contenu).` },
    prospects_semaine: { value: m.prospects ?? 0, note: `${m.prospects} nouvelle(s) famille(s) intéressée(s), ${label} (formulaires du site et prospects notés à la main).` }
  };
}


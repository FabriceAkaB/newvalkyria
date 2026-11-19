import { CLUB_ID } from "@/lib/club";
import {
  findNewFamilies,
  firstDatedSession,
  nextWeeklySession,
  normEmail,
  ONBOARDING_ACTIVE_KEY,
  ONBOARDING_CAMPAIGN,
  ONBOARDING_REF_PREFIX,
  ONBOARDING_STEPS,
  parseActive,
  parseVideoUrl,
  planOnboarding,
  torontoDate,
  WELCOME_VIDEO_KEY,
  type FirstSession,
  type OnboardingFamily,
  type OnboardingStep,
  type PaidRegistration
} from "@/lib/onboarding-30-days";
import { scheduleEmails } from "@/lib/scheduled-emails";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Les 30 premiers jours d'une nouvelle famille (P4.2.03) : trouve les familles payées dans les dernières 24 h qui
 *  n'ont pas encore leur séquence et programme leurs courriels (envoyés par le cron horaire `sendDueEmails`).
 *  Mode assistant tant que `app_settings` « accueil_30_jours_actif » n'est pas à « true » : rien n'est écrit,
 *  le rapport montre ce qui serait programmé. */

function db() {
  return getSupabaseAdminClient() as any;
}

const PAID_SEASON = "paid";
const TEST_SEASONS = ["demo"];
const stepLabel = (step: OnboardingStep) => ONBOARDING_STEPS.find((s) => s.step === step)?.label ?? step;
export const onboardingCampaign = (step: OnboardingStep) => `${ONBOARDING_CAMPAIGN} · ${stepLabel(step)}`;

export interface OnboardingSettings {
  active: boolean;
  videoUrl: string | null;
}

export async function getOnboardingSettings(): Promise<OnboardingSettings> {
  const { data } = await db().from("app_settings").select("key, value").eq("club_id", CLUB_ID).in("key", [ONBOARDING_ACTIVE_KEY, WELCOME_VIDEO_KEY]);
  const get = (k: string) => ((data ?? []) as { key: string; value: string }[]).find((r) => r.key === k)?.value ?? null;
  return { active: parseActive(get(ONBOARDING_ACTIVE_KEY)), videoUrl: parseVideoUrl(get(WELCOME_VIDEO_KEY)) };
}

export async function saveOnboardingSettings(input: { active?: boolean; videoUrl?: string | null }): Promise<void> {
  const at = new Date().toISOString();
  const rows: { club_id: string; key: string; value: string; updated_at: string }[] = [];
  if (typeof input.active === "boolean") rows.push({ club_id: CLUB_ID, key: ONBOARDING_ACTIVE_KEY, value: input.active ? "true" : "false", updated_at: at });
  if (input.videoUrl !== undefined) rows.push({ club_id: CLUB_ID, key: WELCOME_VIDEO_KEY, value: parseVideoUrl(input.videoUrl) ?? "", updated_at: at });
  if (!rows.length) return;
  const { error } = await db().from("app_settings").upsert(rows, { onConflict: "club_id,key" });
  if (error) throw new Error(error.message);
}

interface RegRow extends PaidRegistration {
  createdAt: string;
  slotId?: string | null;
  seasonId?: string | null;
  programSlug?: string | null;
}

/** Moment du paiement de chaque inscription, d'après le journal Stripe (`stripe_events`). */
async function stripePaidTimes(since: string): Promise<Map<string, string>> {
  const { data } = await db()
    .from("stripe_events")
    .select("created_at, kind:payload->>type, rid:payload->data->object->metadata->>registrationId")
    .gte("created_at", since)
    .limit(1000);
  const map = new Map<string, string>();
  for (const e of (data ?? []) as { created_at: string; kind: string | null; rid: string | null }[]) {
    if (e.kind !== "checkout.session.completed" || !e.rid) continue;
    const prev = map.get(e.rid);
    if (!prev || e.created_at < prev) map.set(e.rid, e.created_at);
  }
  return map;
}

async function loadRegistrations(since: string): Promise<{ recent: RegRow[]; history: PaidRegistration[] }> {
  const paidTimes = await stripePaidTimes(new Date(new Date(since).getTime() - 3_600_000).toISOString());
  const [{ data: season }, { data: progs }, { data: sessions }, { data: sessionProgs }, { data: se }] = await Promise.all([
    db().from("registrations").select("id, season_id, program_id, time_slot_template_id, parent_name, parent_email, player_first_name, player_last_name, created_at").eq("status", PAID_SEASON).eq("is_trial", false),
    db().from("programs").select("season_id, id, name"),
    db().from("session_program_registrations").select("id, program_slug, parent_name, parent_email, player_first_name, player_last_name, created_at").eq("status", "paid"),
    db().from("session_programs").select("slug, name"),
    db().from("sport_etudes_registrations").select("id, parent_first_name, parent_last_name, parent_email, player_first_name, player_last_name, created_at").in("status", ["paid", "confirmed"])
  ]);
  const progName = new Map(((progs ?? []) as any[]).map((p) => [`${p.season_id}|${p.id}`, p.name as string]));
  const sessionName = new Map(((sessionProgs ?? []) as any[]).map((p) => [p.slug as string, String(p.name ?? "").replace(/\s*\([^)]*\)\s*$/, "")]));
  const all: RegRow[] = [
    ...((season ?? []) as any[])
      .filter((r) => !TEST_SEASONS.includes(r.season_id))
      .map((r) => ({ id: r.id, source: "saison" as const, email: r.parent_email, parentName: r.parent_name, playerFirstName: r.player_first_name, playerLastName: r.player_last_name, paidAt: paidTimes.get(r.id) ?? r.created_at, createdAt: r.created_at, programLabel: progName.get(`${r.season_id}|${r.program_id}`) ?? null, slotId: r.time_slot_template_id, seasonId: r.season_id })),
    ...((sessions ?? []) as any[]).map((r) => ({ id: r.id, source: "programme" as const, email: r.parent_email, parentName: r.parent_name, playerFirstName: r.player_first_name, playerLastName: r.player_last_name, paidAt: paidTimes.get(r.id) ?? r.created_at, createdAt: r.created_at, programLabel: sessionName.get(r.program_slug) ?? r.program_slug, programSlug: r.program_slug }))
  ];
  const history: PaidRegistration[] = [
    // L'historique se date par la création de la ligne : une ancienne inscription reste ancienne.
    ...all.map((r) => ({ ...r, paidAt: r.createdAt })),
    ...((se ?? []) as any[]).map((r) => ({ id: r.id, source: "sport-etudes" as const, email: r.parent_email, parentName: `${r.parent_first_name ?? ""} ${r.parent_last_name ?? ""}`.trim(), playerFirstName: r.player_first_name, playerLastName: r.player_last_name, paidAt: r.created_at, programLabel: "Sport-Études" }))
  ];
  // Payée dans la fenêtre = paiement Stripe ou création récente ; une ancienne ligne modifiée aujourd'hui ne compte pas.
  const recent = all.filter((r) => r.paidAt >= since);
  return { recent, history };
}

/** 1re séance : MonClubSportif fait foi (équipe qui porte la plage ou le programme) ; sinon la plage hebdomadaire
 *  de la saison ou les dates du programme. */
async function firstSessionFor(regs: RegRow[], afterMs: number): Promise<FirstSession | null> {
  const slotIds = [...new Set(regs.map((r) => r.slotId).filter(Boolean))] as string[];
  const slugs = [...new Set(regs.map((r) => r.programSlug).filter(Boolean))] as string[];
  const day = torontoDate(afterMs);
  const found: FirstSession[] = [];

  const { data: teams } = await db().from("mcs_teams").select("id, slot_ids, session_program_slugs").eq("club_id", CLUB_ID).eq("active", true);
  const teamIds = ((teams ?? []) as any[])
    .filter((t) => (t.slot_ids ?? []).some((s: string) => slotIds.includes(s)) || (t.session_program_slugs ?? []).some((s: string) => slugs.includes(s)))
    .map((t) => t.id as string);
  if (teamIds.length) {
    const { data: events } = await db().from("mcs_events").select("event_date, start_time, end_time, location, type").in("team_id", teamIds).gte("event_date", day).order("event_date").limit(40);
    const rows = ((events ?? []) as any[]).filter((e) => String(e.type ?? "").toLowerCase() !== "match").map((e) => ({ date: String(e.event_date).slice(0, 10), start: e.start_time, end: e.end_time, location: e.location }));
    const s = firstDatedSession(rows, afterMs, "monclubsportif");
    if (s) found.push(s);
  }

  if (!found.length && slotIds.length) {
    const { data: slots } = await db().from("time_slot_templates").select("id, season_id, day, start_time, end_time, location").in("id", slotIds);
    const seasonIds = [...new Set(((slots ?? []) as any[]).map((s) => s.season_id))];
    const { data: seasons } = seasonIds.length ? await db().from("seasons").select("id, starts_on").in("id", seasonIds) : { data: [] };
    const starts = new Map(((seasons ?? []) as any[]).map((s) => [s.id, s.starts_on ? String(s.starts_on).slice(0, 10) : null]));
    for (const slot of (slots ?? []) as any[]) {
      const s = nextWeeklySession(slot, afterMs, starts.get(slot.season_id) ?? null);
      if (s) found.push(s);
    }
  }
  if (!found.length && slugs.length) {
    const { data: dates } = await db().from("session_program_dates").select("session_date, start_time, end_time, location").in("program_slug", slugs).gte("session_date", day).order("session_date").limit(40);
    const s = firstDatedSession(((dates ?? []) as any[]).map((d) => ({ date: String(d.session_date).slice(0, 10), start: d.start_time, end: d.end_time, location: d.location })), afterMs, "horaire");
    if (s) found.push(s);
  }
  return found.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))[0] ?? null;
}

export interface OnboardingFamilyReport {
  parentName: string | null;
  children: string[];
  programs: string[];
  paidAt: string;
  firstSession: FirstSession | null;
  steps: { step: OnboardingStep; sendAt: string }[];
}

export interface OnboardingRunReport {
  active: boolean;
  dryRun: boolean;
  since: string;
  /** Inscriptions payées dans la fenêtre. */
  paidRecently: number;
  /** Familles déjà connues (saison précédente, autre programme, autre parent). */
  notNew: number;
  newFamilies: number;
  /** Nouvelles familles dont toute la séquence est déjà programmée. */
  alreadyScheduled: number;
  emailsPlanned: number;
  emailsScheduled: number;
  /** Nouvelles familles sans 1re séance connue (rappel et « après » sautés). */
  withoutSession: number;
  /** Courriels en attente annulés : la famille n'a plus d'inscription payée (annulée ou remboursée). */
  cancelled: number;
  families: OnboardingFamilyReport[];
}

/** Annule les courriels d'accueil en attente d'une famille qui n'a plus aucune inscription payée. */
async function cancelForUnpaidFamilies(paidEmails: Set<string>, dryRun: boolean): Promise<number> {
  const { data } = await db().from("scheduled_emails").select("id, to_email").eq("club_id", CLUB_ID).eq("status", "en_attente").like("ref", `${ONBOARDING_REF_PREFIX}%`);
  const ids = ((data ?? []) as any[]).filter((r) => !paidEmails.has(normEmail(r.to_email))).map((r) => r.id as string);
  if (ids.length && !dryRun) await db().from("scheduled_emails").update({ status: "annule" }).in("id", ids).eq("status", "en_attente");
  return ids.length;
}

/** À appeler chaque heure (cron) ou juste après un paiement. `dryRun` (ou le réglage éteint) : rien n'est écrit. */
export async function scheduleOnboardingForNewFamilies(options: { dryRun?: boolean; now?: Date; windowHours?: number } = {}): Promise<OnboardingRunReport> {
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - (options.windowHours ?? 24) * 3_600_000).toISOString();
  const settings = await getOnboardingSettings();
  const dryRun = options.dryRun === true || !settings.active;

  const { recent, history } = await loadRegistrations(since);
  const { families, notNew } = findNewFamilies(recent, history, since);

  const { data: existing } = await db().from("scheduled_emails").select("ref").eq("club_id", CLUB_ID).like("ref", `${ONBOARDING_REF_PREFIX}%`);
  const refs = new Set(((existing ?? []) as { ref: string }[]).map((r) => r.ref));

  const report: OnboardingRunReport = { active: settings.active, dryRun, since, paidRecently: recent.length, notNew, newFamilies: families.length, alreadyScheduled: 0, emailsPlanned: 0, emailsScheduled: 0, withoutSession: 0, cancelled: 0, families: [] };
  for (const f of families) {
    const regs = recent.filter((r) => f.registrationIds.includes(r.id));
    const firstSession = await firstSessionFor(regs, new Date(f.paidAt).getTime());
    const family: OnboardingFamily = { ...f, firstSession };
    if (!firstSession) report.withoutSession++;
    const planned = planOnboarding(family, now, settings.videoUrl, refs);
    if (!planned.length) {
      report.alreadyScheduled++;
      continue;
    }
    report.emailsPlanned += planned.length;
    report.families.push({ parentName: f.parentName, children: f.children, programs: f.programs, paidAt: f.paidAt, firstSession, steps: planned.map((p) => ({ step: p.step, sendAt: p.sendAt })) });
    if (!dryRun) {
      report.emailsScheduled += await scheduleEmails(planned.map((p) => ({ sendAt: p.sendAt, to: p.to, subject: p.subject, html: p.html, text: p.text, campaign: onboardingCampaign(p.step), parentName: p.parentName, playerName: p.playerName, ref: p.ref })));
      for (const p of planned) refs.add(p.ref);
    }
  }

  const paidEmails = new Set(history.filter((h) => h.source !== "sport-etudes").map((h) => normEmail(h.email)));
  report.cancelled = await cancelForUnpaidFamilies(paidEmails, dryRun);
  return report;
}

export interface OnboardingStepCount {
  step: OnboardingStep;
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
}

/** Combien de courriels d'accueil sont en attente, partis, en échec ou annulés, étape par étape. */
export async function getOnboardingCounts(): Promise<OnboardingStepCount[]> {
  const { data } = await db().from("scheduled_emails").select("ref, status").eq("club_id", CLUB_ID).like("ref", `${ONBOARDING_REF_PREFIX}%`);
  return ONBOARDING_STEPS.map(({ step }) => {
    const rows = ((data ?? []) as { ref: string; status: string }[]).filter((r) => r.ref.endsWith(`:${step}`));
    const n = (s: string) => rows.filter((r) => r.status === s).length;
    return { step, pending: n("en_attente"), sent: n("envoye"), failed: n("echec"), cancelled: n("annule") };
  });
}

import { randomBytes } from "node:crypto";

import { env } from "@/lib/env";
import { logOutreach } from "@/lib/outreach";
import { getFamilyRegistrations, getParentAccount } from "@/lib/parent-repo";
import { getResendClient } from "@/lib/resend";
import { scheduleEmails } from "@/lib/scheduled-emails";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncRefTask } from "@/lib/team-tasks-repo";
import {
  costPerPlayerCents,
  costRange,
  datesLabel,
  deadlineLabel,
  isEligible,
  isExpired,
  money,
  nextOffers,
  payDeadline,
  planGo,
  playerKey,
  progress,
  readSettings,
  reminderAt,
  surveySaysInterested,
  tally,
  yearsMatch,
  type OfferStatus,
  type ResponseLite,
  type Tally,
  type TournamentAnswer,
  type TournamentSettings
} from "@/lib/tournaments-core";

/** Tournois (JP, 25 nov. 2026) : un tournoi = un programme à dates fixes `program_kind = 'tournoi'`
 *  (réglages dans `presentation.tournament`), réponses des familles dans `tournament_responses`,
 *  paiement par l'inscription habituelle (`session_program_registrations`, checkoutType « sessionprogram »,
 *  métadonnée `tournamentResponseId`, traité dans le webhook unique). */

function db() {
  return getSupabaseAdminClient() as any;
}

const CHRISTINE = "Christinedurand.2@hotmail.com";
const KIND = "tournoi";
const SURVEY_INTEREST_Q = "tournoi-av-ontario";

export interface Tournament {
  slug: string;
  name: string;
  published: boolean;
  birthYears: string[];
  minPlayers: number;
  maxPlayers: number;
  priceCents: number;
  dates: string[];
  datesLabel: string;
  settings: TournamentSettings;
  presentation: Record<string, unknown>;
  tally: Tally;
  progress: ReturnType<typeof progress>;
  cost: { high: number | null; low: number | null; now: number | null };
}

export interface ResponseRow {
  id: string;
  programSlug: string;
  playerKey: string;
  playerId: string | null;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  parentEmail: string | null;
  parentName: string | null;
  response: TournamentAnswer;
  source: "famille" | "sondage" | "admin";
  respondedAt: string;
  token: string;
  offerStatus: OfferStatus | null;
  offeredAt: string | null;
  payDeadline: string | null;
  registrationId: string | null;
}

const toRow = (r: any): ResponseRow => ({
  id: r.id,
  programSlug: r.program_slug,
  playerKey: r.player_key,
  playerId: r.player_id ?? null,
  firstName: r.player_first_name,
  lastName: r.player_last_name ?? "",
  birthYear: r.birth_year ?? null,
  parentEmail: r.parent_email ?? null,
  parentName: r.parent_name ?? null,
  response: r.response,
  source: r.source,
  respondedAt: r.responded_at,
  token: r.token,
  offerStatus: r.offer_status ?? null,
  offeredAt: r.offered_at ?? null,
  payDeadline: r.pay_deadline ?? null,
  registrationId: r.registration_id ?? null
});

const lite = (r: ResponseRow): ResponseLite => ({ id: r.id, response: r.response, respondedAt: r.respondedAt, offerStatus: r.offerStatus });

function build(p: any, dates: string[], rows: ResponseRow[]): Tournament {
  const settings = readSettings(p.presentation);
  const years = (p.eligible_birth_years ?? []).map(String);
  const minPlayers = Math.max(1, p.min_capacity ?? 1);
  const maxPlayers = Math.max(minPlayers, p.max_capacity ?? minPlayers);
  const t = tally(rows.map(lite));
  const prog = progress(rows.map(lite), minPlayers);
  const range = costRange(settings, minPlayers, maxPlayers);
  return {
    slug: p.slug,
    name: p.name,
    published: !!p.published,
    birthYears: years,
    minPlayers,
    maxPlayers,
    priceCents: p.price_cents ?? 0,
    dates,
    datesLabel: datesLabel(dates),
    settings,
    presentation: (p.presentation ?? {}) as Record<string, unknown>,
    tally: t,
    progress: prog,
    cost: { ...range, now: settings.go ? settings.go.priceCents : costPerPlayerCents(settings, Math.min(maxPlayers, Math.max(minPlayers, prog.count))) }
  };
}

export async function listTournaments(opts: { publishedOnly?: boolean; excludeTests?: boolean } = {}): Promise<Tournament[]> {
  let q = db().from("session_programs").select("*").eq("program_kind", KIND).order("created_at", { ascending: true });
  if (opts.publishedOnly) q = q.eq("published", true);
  const { data: programs } = await q;
  const list = (programs ?? []) as any[];
  if (!list.length) return [];
  const slugs = list.map((p) => p.slug);
  const [{ data: dates }, { data: resp }] = await Promise.all([
    db().from("session_program_dates").select("program_slug, session_date").in("program_slug", slugs),
    db().from("tournament_responses").select("*").in("program_slug", slugs)
  ]);
  const out = list.filter((p) => !(opts.publishedOnly && opts.excludeTests !== false && readSettings(p.presentation).test)).map((p) =>
    build(
      p,
      ((dates ?? []) as any[]).filter((d) => d.program_slug === p.slug).map((d) => String(d.session_date).slice(0, 10)),
      ((resp ?? []) as any[]).filter((r) => r.program_slug === p.slug).map(toRow)
    )
  );
  // Le plus proche d'abord ; sans date à la fin.
  return out.sort((a, b) => (a.dates[0] ?? "9999").localeCompare(b.dates[0] ?? "9999"));
}

export async function getTournament(slug: string): Promise<{ tournament: Tournament; responses: ResponseRow[] } | null> {
  const { data: p } = await db().from("session_programs").select("*").eq("slug", slug).eq("program_kind", KIND).maybeSingle();
  if (!p) return null;
  const [{ data: dates }, { data: resp }] = await Promise.all([
    db().from("session_program_dates").select("session_date").eq("program_slug", slug),
    db().from("tournament_responses").select("*").eq("program_slug", slug)
  ]);
  const responses = ((resp ?? []) as any[]).map(toRow);
  return { tournament: build(p, ((dates ?? []) as any[]).map((d) => String(d.session_date).slice(0, 10)), responses), responses };
}

/* ── Les joueuses visées (inscrites payées de la saison active) ─────────────────────────────── */

export interface RosterGirl {
  key: string;
  registrationId: string;
  playerId: string | null;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  /** Naissance et catégorie (une fille de 2014 peut jouer en 2015). */
  years: number[];
  programId: string | null;
  advanced: boolean;
  parentEmail: string;
  parentName: string;
  parentPhone: string;
  /** Saison de démonstration (famille de test) : visée seulement par un tournoi d'essai. */
  demo: boolean;
}

async function seasonGirls(): Promise<RosterGirl[]> {
  const { data: season } = await db().from("seasons").select("id").eq("is_active", true).limit(1).maybeSingle();
  const seasons = [season?.id, "demo"].filter(Boolean) as string[];
  const q = db().from("registrations").select("id, season_id, player_id, player_first_name, player_last_name, player_dob, category_id, program_id, advanced_group, parent_email, parent_name, parent_phone, created_at").eq("status", "paid").eq("is_trial", false).in("season_id", seasons);
  const { data } = await q.order("created_at", { ascending: false });
  const out = new Map<string, RosterGirl>();
  for (const r of (data ?? []) as any[]) {
    const key = playerKey(r.player_first_name ?? "", r.player_last_name ?? "");
    if (!key || out.has(key)) continue;
    out.set(key, {
      key,
      registrationId: r.id,
      playerId: r.player_id ?? null,
      firstName: String(r.player_first_name ?? "").trim(),
      lastName: String(r.player_last_name ?? "").trim(),
      birthYear: r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : null,
      years: [r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : null, /^\d{4}$/.test(String(r.category_id ?? "")) ? Number(r.category_id) : null].filter((y): y is number => !!y),
      programId: r.program_id ?? null,
      // Groupe avancé : programme avancé (TVA, SVA), comme l'équipe de matchs AV du robot MonClubSportif, ou groupe avancé coché.
      advanced: /^(TVA|SVA)$/.test(String(r.program_id ?? "")) || !!r.advanced_group,
      parentEmail: String(r.parent_email ?? "").trim().toLowerCase(),
      parentName: String(r.parent_name ?? "").trim(),
      parentPhone: String(r.parent_phone ?? "").trim(),
      demo: r.season_id === "demo"
    });
  }
  return [...out.values()];
}

export async function getRoster(t: Tournament): Promise<RosterGirl[]> {
  return (await seasonGirls()).filter((g) => isEligible(g, t.settings, t.birthYears)).sort((a, b) => a.firstName.localeCompare(b.firstName, "fr"));
}

/** Vue de JP : chaque joueuse visée avec sa réponse, puis les réponses hors liste. */
export async function getAdminTournament(slug: string) {
  const found = await getTournament(slug);
  if (!found) return null;
  const roster = await getRoster(found.tournament);
  const byKey = new Map(found.responses.map((r) => [r.playerKey, r]));
  const people = roster.map((g) => ({ girl: g, response: byKey.get(g.key) ?? null }));
  const inRoster = new Set(roster.map((g) => g.key));
  const others = found.responses.filter((r) => !inRoster.has(r.playerKey));
  const { data: regs } = await db().from("session_program_registrations").select("id, status, price_cents, stripe_payment_intent_id").eq("program_slug", slug).eq("status", "paid");
  const collectedCents = ((regs ?? []) as any[]).reduce((s, r) => s + (r.price_cents ?? 0), 0);
  return { ...found, people, others, collectedCents };
}

/* ── Réponse d'une famille ──────────────────────────────────────────────────────────────────── */

export async function setResponse(input: {
  slug: string;
  firstName: string;
  lastName: string;
  answer: TournamentAnswer;
  source: "famille" | "sondage" | "admin";
  birthYear?: number | null;
  playerId?: string | null;
  parentEmail?: string | null;
  parentName?: string | null;
  parentUserId?: string | null;
}): Promise<{ ok: true; row: ResponseRow } | { ok: false; error: string }> {
  const found = await getTournament(input.slug);
  if (!found) return { ok: false, error: "Tournoi introuvable." };
  const key = playerKey(input.firstName, input.lastName);
  if (!key) return { ok: false, error: "Nom de la joueuse manquant." };
  const now = new Date().toISOString();
  const existing = found.responses.find((r) => r.playerKey === key);
  if (existing?.offerStatus === "payee") return { ok: false, error: "Sa place est déjà payée. Pour un changement, écrivez-nous à info@newvalkyria.com." };

  if (existing) {
    const patch: Record<string, unknown> = { response: input.answer, updated_at: now };
    if (existing.response !== input.answer) patch.responded_at = now;
    if (input.source !== "sondage") patch.source = input.source;
    if (input.parentEmail) patch.parent_email = input.parentEmail.toLowerCase();
    if (input.parentName) patch.parent_name = input.parentName;
    if (input.parentUserId) patch.parent_user_id = input.parentUserId;
    // Place offerte puis « pas cette fois » : la place est rendue et passe à la suivante.
    if (existing.offerStatus === "offerte" && input.answer === "pas_cette_fois") patch.offer_status = "retiree";
    // Elle revient (après un « pas cette fois » ou une date limite manquée) : de retour dans la file, à la fin.
    if ((existing.offerStatus === "retiree" || existing.offerStatus === "expiree") && input.answer !== "pas_cette_fois") {
      patch.offer_status = null;
      patch.responded_at = now;
    }
    const { data, error } = await db().from("tournament_responses").update(patch).eq("id", existing.id).select("*").single();
    if (error) return { ok: false, error: error.message };
    if (patch.offer_status === "retiree") {
      await cancelReminder(existing.id);
      await fillFreedPlaces(input.slug);
    }
    await syncGoTask(input.slug);
    return { ok: true, row: toRow(data) };
  }

  const { data, error } = await db()
    .from("tournament_responses")
    .insert({
      program_slug: input.slug,
      player_key: key,
      player_id: input.playerId ?? null,
      player_first_name: input.firstName.trim(),
      player_last_name: input.lastName.trim(),
      birth_year: input.birthYear ?? null,
      parent_email: input.parentEmail?.toLowerCase() ?? null,
      parent_name: input.parentName ?? null,
      parent_user_id: input.parentUserId ?? null,
      response: input.answer,
      source: input.source,
      token: randomBytes(18).toString("base64url")
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  await syncGoTask(input.slug);
  // Après le go, une nouvelle disponible prend une place libre s'il en reste.
  if (found.tournament.settings.go) await fillFreedPlaces(input.slug);
  return { ok: true, row: toRow(data) };
}

/** Réponse depuis la page à lien privé : la joueuse doit être dans l'équipe visée, au courriel de son inscription. */
export async function setResponseFromPrivatePage(input: { slug: string; firstName: string; lastName: string; parentEmail: string; answer: TournamentAnswer }) {
  const found = await getTournament(input.slug);
  if (!found || !found.tournament.published) return { ok: false as const, error: "Tournoi introuvable." };
  const key = playerKey(input.firstName, input.lastName);
  const girl = (await getRoster(found.tournament)).find((g) => g.key === key) ?? (found.responses.some((r) => r.playerKey === key) ? (await seasonGirls()).find((g) => g.key === key) : undefined);
  if (!girl) return { ok: false as const, error: "Nous ne trouvons pas cette joueuse dans l'équipe visée par ce tournoi. Vérifiez l'orthographe, ou écrivez-nous à info@newvalkyria.com." };
  if (girl.parentEmail !== input.parentEmail.trim().toLowerCase()) return { ok: false as const, error: "Utilisez le courriel donné à l'inscription de votre fille (ou connectez-vous à votre espace famille)." };
  return setResponse({ slug: input.slug, firstName: girl.firstName, lastName: girl.lastName, birthYear: girl.birthYear, playerId: girl.playerId, parentEmail: girl.parentEmail, parentName: girl.parentName, answer: input.answer, source: "famille" });
}

export async function getResponseByToken(token: string): Promise<ResponseRow | null> {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const { data } = await db().from("tournament_responses").select("*").eq("token", token).maybeSingle();
  return data ? toRow(data) : null;
}

export async function setResponseByToken(token: string, answer: TournamentAnswer) {
  const r = await getResponseByToken(token);
  if (!r) return { ok: false as const, error: "Lien invalide." };
  return setResponse({ slug: r.programSlug, firstName: r.firstName, lastName: r.lastName, answer, source: "famille" });
}

/* ── Espace famille ─────────────────────────────────────────────────────────────────────────── */

export interface FamilyTournament {
  tournament: Tournament;
  girls: { firstName: string; lastName: string; response: ResponseRow | null }[];
}

export async function getFamilyTournaments(userId: string): Promise<FamilyTournament[]> {
  const [regs, tournaments] = await Promise.all([getFamilyRegistrations(userId), listTournaments({ publishedOnly: true, excludeTests: false })]);
  if (!regs.length || !tournaments.length) return [];
  const all = await seasonGirls();
  const mine = regs.map((r) => all.find((g) => g.key === playerKey(r.firstName, r.lastName))).filter((g): g is RosterGirl => Boolean(g));
  const keys = mine.map((g) => g.key);
  const { data: resp } = keys.length ? await db().from("tournament_responses").select("*").in("player_key", keys).in("program_slug", tournaments.map((t) => t.slug)) : { data: [] };
  const rows = ((resp ?? []) as any[]).map(toRow);
  return tournaments
    .map((t) => ({
      tournament: t,
      girls: mine.filter((g) => isEligible(g, t.settings, t.birthYears) || rows.some((r) => r.programSlug === t.slug && r.playerKey === g.key)).map((g) => ({ firstName: g.firstName, lastName: g.lastName, response: rows.find((r) => r.programSlug === t.slug && r.playerKey === g.key) ?? null }))
    }))
    .filter((x) => x.girls.length > 0);
}

/** Le parent répond pour une de SES filles (vérifiée par le nom, parmi les inscriptions de la famille). */
export async function setFamilyResponse(userId: string, input: { slug: string; firstName: string; lastName: string; answer: TournamentAnswer }) {
  const regs = await getFamilyRegistrations(userId);
  const key = playerKey(input.firstName, input.lastName);
  if (!regs.some((r) => playerKey(r.firstName, r.lastName) === key)) return { ok: false as const, error: "Cette joueuse n'est pas dans votre famille." };
  const found = await getTournament(input.slug);
  if (!found || !found.tournament.published) return { ok: false as const, error: "Tournoi introuvable." };
  const girl = (await seasonGirls()).find((g) => g.key === key);
  if (!girl || (!isEligible(girl, found.tournament.settings, found.tournament.birthYears) && !found.responses.some((r) => r.playerKey === key))) return { ok: false as const, error: "Ce tournoi ne vise pas l'équipe de votre fille." };
  const account = await getParentAccount(userId);
  return setResponse({ slug: input.slug, firstName: girl.firstName, lastName: girl.lastName, birthYear: girl.birthYear, playerId: girl.playerId, parentEmail: girl.parentEmail || account?.email, parentName: girl.parentName || account?.fullName, parentUserId: userId, answer: input.answer, source: "famille" });
}

/* ── Sondage d'intérêt → premières réponses ─────────────────────────────────────────────────── */

/** Les familles qui ont dit oui au sondage et coché la date de ce tournoi deviennent « intéressées »
 *  (jamais par-dessus une réponse déjà donnée). */
export async function importSurveyInterest(slug: string): Promise<{ added: number; skipped: string[] }> {
  const found = await getTournament(slug);
  const survey = found?.tournament.settings.survey;
  if (!found || !survey) return { added: 0, skipped: [] };
  const [roster, all] = await Promise.all([getRoster(found.tournament), seasonGirls()]);
  const { data } = await db().from("survey_responses").select("answers, created_at, invite:survey_invites(parent_email, parent_name, player_names)").eq("survey_id", survey.id);
  let added = 0;
  const skipped: string[] = [];
  const have = new Set(found.responses.map((r) => r.playerKey));
  for (const r of (data ?? []) as any[]) {
    if (!surveySaysInterested(r.answers ?? {}, SURVEY_INTEREST_Q, survey.option)) continue;
    for (const name of String(r.invite?.player_names ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
      // Le sondage est l'audience choisie par JP : une fille de la bonne année qui a dit oui est reprise même hors
      // du groupe avancé (elle paraît alors « hors de la liste visée » dans l'admin).
      const exact = roster.find((g) => g.key === playerKey(name, "")) ?? all.find((g) => g.key === playerKey(name, "") && !g.demo === !found.tournament.settings.test && yearsMatch(g, found.tournament.birthYears));
      if (!exact) {
        // Pas retrouvée dans toute la saison (nom écrit autrement, essai) ; une fille d'une autre équipe est ignorée sans bruit.
        if (!all.some((g) => g.key === playerKey(name, ""))) skipped.push(name);
        continue;
      }
      if (have.has(exact.key)) continue;
      const { error } = await db().from("tournament_responses").insert({
        program_slug: slug,
        player_key: exact.key,
        player_id: exact.playerId,
        player_first_name: exact.firstName,
        player_last_name: exact.lastName,
        birth_year: exact.birthYear,
        parent_email: (r.invite?.parent_email ?? exact.parentEmail ?? "").toLowerCase() || null,
        parent_name: r.invite?.parent_name ?? exact.parentName,
        response: "interessee",
        source: "sondage",
        responded_at: r.created_at,
        token: randomBytes(18).toString("base64url")
      });
      if (!error) {
        added++;
        have.add(exact.key);
      }
    }
  }
  return { added, skipped };
}

/* ── Tâches de JP ───────────────────────────────────────────────────────────────────────────── */

const adminUrl = (slug: string) => `${env.publicSiteUrl}/admin/tournois/${slug}`;

/** Minimum atteint et pas encore de go : tâche « Donner le go » ; cochée toute seule au go. */
export async function syncGoTask(slug: string): Promise<void> {
  const found = await getTournament(slug);
  if (!found) return;
  const t = found.tournament;
  const ref = `tournoi:${slug}:go`;
  if (t.settings.go) return syncRefTask(ref, { title: `Tournoi : donner le go pour ${t.name}`, done: true, doneNote: "Go donné" }).catch(() => undefined);
  if (!t.progress.reached) return;
  await syncRefTask(ref, {
    title: `Tournoi : donner le go pour ${t.name}`,
    details: `${t.progress.count} disponibles sur un minimum de ${t.minPlayers} (${t.settings.teamLabel || "équipe visée"}). Coût par joueuse au go : environ ${money(t.cost.now)}. Décider : ${adminUrl(slug)}`,
    due: new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" })
  }).catch((e) => console.error("tournoi go task", e));
}

/* ── Go : une place offerte à chaque disponible ─────────────────────────────────────────────── */

const wrap = (inner: string) => `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px">${inner}</div>`;
const btn = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">${label}</a></p><p style="font-size:13px;color:#666;margin-top:-6px">Ou copiez ce lien : <a href="${href}">${href}</a></p>`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const firstWord = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] ?? "";

export const responseUrl = (slug: string, token: string) => `${env.publicSiteUrl}/tournois/${slug}?r=${token}`;

function offerMail(t: Tournament, r: ResponseRow, deadline: string, reminder = false) {
  const url = responseUrl(t.slug, r.token);
  const price = money(t.settings.go?.priceCents ?? t.priceCents);
  const where = [t.settings.venue, t.settings.location].filter(Boolean).join(", ");
  const subject = reminder ? `Rappel : la place de ${r.firstName} au ${t.name}, à payer avant ${deadlineLabel(deadline)}` : `${t.name} : c'est parti ! La place de ${r.firstName} est réservée`;
  const hello = r.parentName ? `Bonjour ${esc(firstWord(r.parentName))},` : "Bonjour,";
  const intro = reminder
    ? `<p>Petit rappel : la place de <strong>${esc(r.firstName)}</strong> au <strong>${esc(t.name)}</strong> n'est pas encore payée. Elle reste réservée jusqu'au <strong>${deadlineLabel(deadline)}</strong> ; ensuite, elle passe à la joueuse suivante sur la liste.</p>`
    : `<p>Bonne nouvelle : assez de familles ont confirmé, nous inscrivons l'équipe au <strong>${esc(t.name)}</strong>. Une place est réservée pour <strong>${esc(r.firstName)}</strong>.</p>`;
  const html = wrap(
    `<p>${hello}</p>${intro}<p><strong>Quand :</strong> ${esc(t.datesLabel)}<br><strong>Où :</strong> ${esc(where || "à confirmer")}<br><strong>Équipe :</strong> ${esc(t.settings.teamLabel || t.name)}<br><strong>Frais de participation :</strong> ${price} (inscription de l'équipe et coach, partagés entre les joueuses)</p>` +
      `<p>Le transport et l'hébergement restent à la charge de chaque famille.</p>` +
      `<p>Pour confirmer sa place, payez avant le <strong>${deadlineLabel(deadline)}</strong> :</p>${btn(url, "Payer la place de " + esc(r.firstName))}` +
      `<p>Elle ne peut plus venir ? Le même lien permet de répondre « Pas cette fois » : sa place ira à une autre joueuse.</p><p>L'équipe New Valkyria</p>`
  );
  const text = `${hello}\n\n${reminder ? `Rappel : la place de ${r.firstName} au ${t.name} n'est pas encore payée. Elle reste réservée jusqu'au ${deadlineLabel(deadline)}, ensuite elle passe à la joueuse suivante.` : `Assez de familles ont confirmé : nous inscrivons l'équipe au ${t.name}. Une place est réservée pour ${r.firstName}.`}\n\nQuand : ${t.datesLabel}\nOù : ${where || "à confirmer"}\nFrais de participation : ${price}\n\nPayer avant le ${deadlineLabel(deadline)} : ${url}\n\nL'équipe New Valkyria`;
  return { subject, html, text };
}

async function cancelReminder(responseId: string): Promise<void> {
  await db().from("scheduled_emails").update({ status: "annule" }).eq("ref", `tournoi:${responseId}`).eq("status", "en_attente");
}

/** Offre une place : date limite, courriel tout de suite (Christine en copie), rappel programmé, journal des relances. */
async function offerPlace(t: Tournament, r: ResponseRow, now = new Date()): Promise<boolean> {
  if (!r.parentEmail) return false;
  const deadline = payDeadline(now, t.settings.payDays);
  const { data: claimed } = await db().from("tournament_responses").update({ offer_status: "offerte", offered_at: now.toISOString(), pay_deadline: deadline, reminder_sent_at: null, updated_at: now.toISOString() }).eq("id", r.id).is("offer_status", null).select("id");
  if (!claimed?.length) return false;
  const mail = offerMail(t, r, deadline);
  const res = await getResendClient().emails.send({ to: r.parentEmail, ...(t.settings.test ? {} : { cc: CHRISTINE }), ...mail } as never).catch((e: unknown) => ({ error: { message: e instanceof Error ? e.message : "erreur" } }));
  const err = (res as { error?: { message: string } | null })?.error;
  if (err) console.error("tournoi offre courriel", r.parentEmail, err.message);
  const reminder = offerMail(t, r, deadline, true);
  await scheduleEmails([{ sendAt: reminderAt(now, deadline, t.settings.reminderHours), to: r.parentEmail, subject: reminder.subject, html: reminder.html, text: reminder.text, campaign: `Tournoi : ${t.name} · rappel de paiement`, parentName: r.parentName, playerName: `${r.firstName} ${r.lastName}`.trim(), ref: `tournoi:${r.id}` }]);
  await logOutreach({ parentEmail: r.parentEmail, parentName: r.parentName, playerName: `${r.firstName} ${r.lastName}`.trim(), campaign: `Tournoi : ${t.name}`, subject: mail.subject, kind: "relance", notes: `Place offerte, ${money(t.settings.go?.priceCents ?? t.priceCents)}, à payer avant le ${deadlineLabel(deadline)}${err ? ` (courriel en échec : ${err.message})` : ""}` }).catch(() => null);
  return !err;
}

export async function giveGo(slug: string, by: string): Promise<{ ok: true; offered: number; waiting: number; priceCents: number } | { ok: false; error: string }> {
  const found = await getTournament(slug);
  if (!found) return { ok: false, error: "Tournoi introuvable." };
  const t = found.tournament;
  if (t.settings.go) return { ok: false, error: "Le go est déjà donné." };
  if (t.settings.entryFeeCents + t.settings.coachFeeCents <= 0) return { ok: false, error: "Indique d'abord le prix d'inscription du tournoi et le salaire du coach." };
  const plan = planGo(found.responses.map(lite), t.maxPlayers);
  if (!plan.offer.length) return { ok: false, error: "Aucune famille disponible : rien à offrir." };
  const priceCents = costPerPlayerCents(t.settings, plan.offer.length) ?? 0;
  const now = new Date();
  const go = { at: now.toISOString(), by, priceCents, players: plan.offer.length, deadline: payDeadline(now, t.settings.payDays) };
  const presentation = { ...t.presentation, tournament: { ...((t.presentation as any).tournament ?? {}), go } };
  const { error } = await db().from("session_programs").update({ presentation, price_cents: priceCents, updated_at: now.toISOString() }).eq("slug", slug);
  if (error) return { ok: false, error: error.message };
  const after = (await getTournament(slug))!.tournament;
  let offered = 0;
  for (const id of plan.offer) {
    const r = found.responses.find((x) => x.id === id);
    if (r && (await offerPlace(after, r, now))) offered++;
    await new Promise((res) => setTimeout(res, 800));
  }
  const day = (n: number) => new Date(now.getTime() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  await syncGoTask(slug);
  await syncRefTask(`tournoi:${slug}:inscription`, {
    title: `Tournoi : inscrire l'équipe au ${t.name} auprès de l'organisateur`,
    details: `${t.settings.organizer ?? "Organisateur"}${t.settings.organizerUrl ? ` (${t.settings.organizerUrl})` : ""} : inscription de ${t.settings.teams} équipe${t.settings.teams > 1 ? "s" : ""}, ${money(t.settings.entryFeeCents * t.settings.teams)}. Les familles paient jusqu'au ${deadlineLabel(go.deadline)} ; suivi des paiements : ${adminUrl(slug)}`,
    due: day(Math.min(3, t.settings.payDays))
  }).catch(() => null);
  await syncRefTask(`tournoi:${slug}:coach`, {
    title: `Tournoi : assigner un coach pour ${t.name}`,
    details: `${t.settings.teams} coach${t.settings.teams > 1 ? "s" : ""} à ${money(t.settings.coachFeeCents)} chacun, ${t.datesLabel}, ${t.settings.location || "lieu à confirmer"}.`,
    due: day(7)
  }).catch(() => null);
  return { ok: true, offered, waiting: plan.waiting.length, priceCents };
}

/** Places libérées (expirée, retirée) ou restantes : offertes à la suivante de la file. */
export async function fillFreedPlaces(slug: string, now = new Date()): Promise<number> {
  const found = await getTournament(slug);
  if (!found?.tournament.settings.go) return 0;
  let n = 0;
  for (const id of nextOffers(found.responses.map(lite), found.tournament.maxPlayers)) {
    const r = found.responses.find((x) => x.id === id);
    if (r && (await offerPlace(found.tournament, r, now))) n++;
  }
  return n;
}

/** Cron horaire : les places non payées à la date limite expirent et passent à la suivante. */
export async function runTournamentDeadlines(now = new Date()): Promise<{ expired: number; offered: number }> {
  const { data } = await db().from("tournament_responses").select("*").eq("offer_status", "offerte").lt("pay_deadline", now.toISOString());
  const rows = ((data ?? []) as any[]).map(toRow).filter((r) => isExpired(r.offerStatus, r.payDeadline, now));
  const slugs = new Set<string>();
  for (const r of rows) {
    const { data: done } = await db().from("tournament_responses").update({ offer_status: "expiree", updated_at: now.toISOString() }).eq("id", r.id).eq("offer_status", "offerte").select("id");
    if (!done?.length) continue;
    await cancelReminder(r.id);
    if (r.parentEmail) await logOutreach({ parentEmail: r.parentEmail, parentName: r.parentName, playerName: `${r.firstName} ${r.lastName}`.trim(), campaign: `Tournoi`, kind: "plus-tard", notes: `Place non payée à la date limite : passée à la suivante (${r.programSlug})` }).catch(() => null);
    slugs.add(r.programSlug);
  }
  let offered = 0;
  for (const slug of slugs) offered += await fillFreedPlaces(slug, now);
  return { expired: rows.length, offered };
}

/* ── Paiement ───────────────────────────────────────────────────────────────────────────────── */

export async function startTournamentCheckout(token: string, origin: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await getResponseByToken(token);
  if (!r) return { ok: false, error: "Lien invalide." };
  if (r.offerStatus === "payee") return { ok: false, error: "Cette place est déjà payée. Merci !" };
  if (r.offerStatus !== "offerte") return { ok: false, error: r.offerStatus === "expiree" ? "La date limite est passée : la place est allée à une autre joueuse. Écrivez-nous si vous voulez être sur la liste." : "Aucune place à payer pour l'instant : vous recevrez un courriel au go." };
  if (r.payDeadline && Date.parse(r.payDeadline) < Date.now()) return { ok: false, error: "La date limite est passée." };
  const found = await getTournament(r.programSlug);
  if (!found) return { ok: false, error: "Tournoi introuvable." };
  const t = found.tournament;
  const price = t.settings.go?.priceCents ?? t.priceCents;
  if (!price || price <= 0) return { ok: false, error: "Le prix n'est pas encore fixé." };

  const girl = (await seasonGirls()).find((g) => g.key === r.playerKey);
  // Un clic = une inscription en attente ; l'ancienne qui n'a pas abouti est annulée.
  await db().from("session_program_registrations").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("program_slug", t.slug).eq("status", "pending").ilike("player_first_name", r.firstName).ilike("player_last_name", r.lastName || "%");
  const { data: reg, error } = await db()
    .from("session_program_registrations")
    .insert({
      program_slug: t.slug,
      player_id: r.playerId ?? girl?.playerId ?? null,
      player_first_name: r.firstName,
      player_last_name: r.lastName || "-",
      birth_year: r.birthYear ?? girl?.birthYear ?? null,
      parent_name: r.parentName || girl?.parentName || "Parent",
      parent_email: r.parentEmail || girl?.parentEmail,
      parent_phone: girl?.parentPhone || "",
      terms_accepted: true,
      status: "pending",
      payment_option: "full",
      price_cents: price,
      list_price_cents: price,
      total_due_cents: price,
      reservation_expires_at: r.payDeadline,
      comments: "Tournoi : frais de participation"
    })
    .select("id")
    .single();
  if (error || !reg) return { ok: false, error: error?.message ?? "Inscription impossible." };

  const back = `${origin}/tournois/${t.slug}?r=${r.token}`;
  const session = await getStripeClient().checkout.sessions.create({
    mode: "payment",
    customer_email: r.parentEmail || girl?.parentEmail || undefined,
    payment_method_types: ["card"],
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: price,
          product_data: { name: `${t.name} · ${r.firstName} ${r.lastName}`.trim(), description: `Frais de participation : inscription de l'équipe et coach, partagés entre les joueuses. ${t.datesLabel}.` }
        }
      }
    ],
    metadata: { checkoutType: "sessionprogram", registrationId: reg.id, programSlug: t.slug, tournamentResponseId: r.id },
    success_url: `${back}&paye=1`,
    cancel_url: back
  });
  if (!session.url) return { ok: false, error: "Stripe n'a pas retourné de lien." };
  await db().from("session_program_registrations").update({ stripe_checkout_session_id: session.id }).eq("id", reg.id);
  return { ok: true, url: session.url };
}

/** Webhook (checkoutType « sessionprogram » + tournamentResponseId) : place payée, rappel annulé, confirmation. */
export async function onTournamentPaid(responseId: string, registration: { id: string; parent_email: string; parent_name: string; price_cents: number | null }): Promise<void> {
  const now = new Date().toISOString();
  const { data } = await db().from("tournament_responses").update({ offer_status: "payee", registration_id: registration.id, updated_at: now }).eq("id", responseId).select("*").maybeSingle();
  await cancelReminder(responseId);
  if (!data) return;
  const r = toRow(data);
  const found = await getTournament(r.programSlug);
  if (!found) return;
  const t = found.tournament;
  const where = [t.settings.venue, t.settings.location].filter(Boolean).join(", ");
  const subject = `${t.name} : la place de ${r.firstName} est confirmée`;
  const html = wrap(
    `<p>Bonjour ${esc(firstWord(registration.parent_name))},</p><p>Merci ! Votre paiement de <strong>${money(registration.price_cents ?? 0)}</strong> est reçu : <strong>${esc(r.firstName)}</strong> joue au <strong>${esc(t.name)}</strong>.</p><p><strong>Quand :</strong> ${esc(t.datesLabel)}<br><strong>Où :</strong> ${esc(where || "à confirmer")}<br><strong>Équipe :</strong> ${esc(t.settings.teamLabel || t.name)}</p><p>L'horaire des matchs, le lieu exact et les consignes arrivent dès que l'organisateur les publie. Le transport et l'hébergement restent à votre charge.</p><p>L'équipe New Valkyria</p>`
  );
  await getResendClient().emails.send({ to: registration.parent_email, subject, html, text: `Merci ! Paiement reçu : ${r.firstName} joue au ${t.name} (${t.datesLabel}, ${where}).\n\nL'équipe New Valkyria` } as never).catch((e: unknown) => console.error("tournoi confirmation", e));
  await logOutreach({ parentEmail: registration.parent_email, parentName: registration.parent_name, playerName: `${r.firstName} ${r.lastName}`.trim(), campaign: `Tournoi : ${t.name}`, subject, kind: "reponse", notes: `Place payée (${money(registration.price_cents ?? 0)})` }).catch(() => null);
}

/* ── Admin : créer et régler ────────────────────────────────────────────────────────────────── */

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

export interface TournamentInput {
  name: string;
  teamLabel?: string;
  birthYears?: string[];
  advancedOnly?: boolean;
  location?: string;
  venue?: string;
  organizer?: string;
  organizerUrl?: string;
  imageUrl?: string;
  info?: string;
  entryFeeCents?: number;
  coachFeeCents?: number;
  teams?: number;
  minPlayers?: number;
  maxPlayers?: number;
  payDays?: number;
  dates?: string[];
  survey?: { id: string; option: string } | null;
  published?: boolean;
}

export async function createTournament(input: TournamentInput): Promise<string> {
  const base = `tournoi-${slugify(input.name)}`;
  const { data: existing } = await db().from("session_programs").select("slug").like("slug", `${base}%`);
  const slug = existing?.length ? `${base}-${existing.length + 1}` : base;
  const { error } = await db().from("session_programs").insert({
    slug,
    name: input.name.trim().slice(0, 120),
    gender: "filles",
    birth_years: "",
    eligible_birth_years: [],
    price_cents: 0,
    max_capacity: 14,
    min_capacity: 10,
    active: false,
    published: false,
    is_private: false,
    program_kind: KIND,
    presentation: { tournament: {} }
  });
  if (error) throw new Error(error.message);
  await updateTournament(slug, input);
  return slug;
}

export async function updateTournament(slug: string, input: Partial<TournamentInput>): Promise<void> {
  const found = await getTournament(slug);
  if (!found) throw new Error("Tournoi introuvable.");
  const cur = ((found.tournament.presentation as any).tournament ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined);
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 2000) : undefined);
  const next: Record<string, unknown> = { ...cur };
  const set = (k: string, v: unknown) => {
    if (v !== undefined) next[k] = v;
  };
  set("teamLabel", s(input.teamLabel));
  set("location", s(input.location));
  set("venue", s(input.venue));
  set("organizer", s(input.organizer));
  set("organizerUrl", s(input.organizerUrl));
  set("imageUrl", s(input.imageUrl));
  set("info", s(input.info));
  set("entryFeeCents", n(input.entryFeeCents));
  set("coachFeeCents", n(input.coachFeeCents));
  set("teams", n(input.teams));
  set("payDays", n(input.payDays));
  if (typeof input.advancedOnly === "boolean") next.advancedOnly = input.advancedOnly;
  if (input.survey !== undefined) next.survey = input.survey && input.survey.id && input.survey.option ? input.survey : null;
  const row: Record<string, unknown> = { presentation: { ...found.tournament.presentation, tournament: next }, updated_at: new Date().toISOString() };
  if (input.name?.trim()) row.name = input.name.trim().slice(0, 120);
  if (input.birthYears) {
    const years = input.birthYears.map((y) => String(y).trim()).filter((y) => /^\d{4}$/.test(y));
    row.eligible_birth_years = years;
    row.birth_years = years.join("-");
  }
  const min = n(input.minPlayers);
  const max = n(input.maxPlayers);
  if (min) row.min_capacity = min;
  if (max) row.max_capacity = Math.max(max, min ?? 1);
  if (typeof input.published === "boolean") row.published = input.published;
  // Avant le go, le prix affiché suit les frais (au minimum de joueuses) ; au go, il est figé.
  if (!found.tournament.settings.go) {
    const settings = readSettings({ tournament: next });
    row.price_cents = costPerPlayerCents(settings, min ?? found.tournament.minPlayers) ?? 0;
  }
  const { error } = await db().from("session_programs").update(row).eq("slug", slug);
  if (error) throw new Error(error.message);
  if (input.dates) {
    const dates = [...new Set(input.dates.map((d) => String(d).slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
    await db().from("session_program_dates").delete().eq("program_slug", slug);
    if (dates.length)
      await db()
        .from("session_program_dates")
        .insert(dates.map((d, i) => ({ program_slug: slug, session_date: d, start_time: "08:00", end_time: "18:00", location: String(next.location ?? ""), display_order: i })));
  }
  await syncGoTask(slug);
}

/** JP retire une place offerte (famille qui s'est désistée par téléphone) : elle passe à la suivante. */
export async function withdrawOffer(responseId: string): Promise<void> {
  const { data } = await db().from("tournament_responses").update({ offer_status: "retiree", updated_at: new Date().toISOString() }).eq("id", responseId).eq("offer_status", "offerte").select("program_slug").maybeSingle();
  await cancelReminder(responseId);
  if (data?.program_slug) await fillFreedPlaces(data.program_slug);
}

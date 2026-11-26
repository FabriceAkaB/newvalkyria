import { signedPhotoUrl } from "@/lib/player-photos";
import { logAudit } from "@/lib/audit-repo";
import { CLUB, CLUB_ID } from "@/lib/club";
import { env } from "@/lib/env";
import { McsRobotError, McsSession, type PresenceGrid } from "@/lib/mcs-robot";
import { getRobotCredentials } from "@/lib/mcs-robot-config";
import { cleanTitle, eventKind, isCancelled, titleDate } from "@/lib/delivery-core";
import { attendanceFromMcs, calendarDiff, dueReminder, isCancelledTitle, isGameTitle, mcsAttendancePlan, memberTeamKey, pendingMcsPlayers, personKey, sameMemberName, teamsFor, yearsOf, type McsRules, type PendingMcsPlayer, type TeamTarget } from "@/lib/mcs-rules";
import { getMcsRules } from "@/lib/mcs-rules-repo";
import { MCS_BASE } from "@/lib/mcs-site-map";
import { OWNER_NOTIFY_EMAIL } from "@/lib/email";
import { getResendClient, isEmailConfigured } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Le chef d'orchestre du robot MonClubSportif (agent A12). Une seule fonction fait tout ce qui manque, dans l'ordre :
 *  1. chaque joueuse payée est dans ses équipes MCS (invitation au parent, tout le calendrier, sa photo) ;
 *  2. chaque joueuse qui a une photo l'a sur son profil ;
 *  3. chaque plage de match payée porte le nom de l'adversaire ;
 *  4. les présences restent modifiables en tout temps.
 *  Elle se lance dès qu'un paiement arrive (webhook Stripe) et chaque heure (cron), et ne refait jamais ce qui est fait :
 *  la vérité est ce qu'on lit dans MonClubSportif. Les rappels de présence sont dans `sendPresenceReminders`. */

function db() {
  return getSupabaseAdminClient() as any;
}

const TZ = CLUB.timezone;
const todayLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

export interface ExpectedPlayer {
  key: string;
  /** Inscription de saison (pour verser ses présences dans le site) ; null pour les programmes à dates fixes. */
  registrationId: string | null;
  /** Demi-saison : dernière date couverte (AAAA-MM-JJ) ; null = toute la saison. */
  halfUntil: string | null;
  /** Programmes achetés : code de saison (TV, SVA…) ou « prog:<slug> » pour un programme à dates fixes. */
  programs: string[];
  firstName: string;
  lastName: string;
  gender: "female" | "male";
  birthYear: number | null;
  parentEmail: string | null;
  parentName: string | null;
  photoUrl: string | null;
  /** Date de l'inscription (sert à repérer les nouvelles joueuses pas encore dans MCS). */
  createdAt: string | null;
  teams: TeamTarget[];
}

export interface RobotReport {
  ok: boolean;
  /** Mode assistant : rien n'a été fait dans MonClubSportif, la liste dit ce que le robot ferait. */
  dryRun: boolean;
  skipped?: string;
  added: string[];
  photos: string[];
  opponents: string[];
  unlocked: string[];
  /** Calendrier : pratiques du site créées ou remises à la bonne heure dans MonClubSportif. */
  calendar: string[];
  /** Pratiques MonClubSportif qui ne sont plus dans le site : à vérifier (jamais supprimées toutes seules). */
  extras: string[];
  /** Direction assignée à toutes les activités (ex. JP dans chaque équipe). */
  staff?: string[];
  /** Demi-saison : activités retirées après la fin (ou rendues si la 2e partie est payée). */
  halfSeason?: string[];
  /** Présences mises par défaut (ex. JP présent à tout). */
  presences?: string[];
  errors: string[];
}

export async function loadTeamTargets(): Promise<TeamTarget[]> {
  const { data } = await db().from("mcs_teams").select("id, name, kind, birth_years, slot_ids, program_ids, session_program_slugs, mcs_team_id, mcs_season_id, active").eq("club_id", CLUB_ID);
  return ((data ?? []) as any[]).filter((t) => t.active !== false) as TeamTarget[];
}

/** Toutes les joueuses et tous les joueurs inscrits et payés, avec les équipes MCS où ils doivent être. */
export async function loadExpectedPlayers(teams?: TeamTarget[]): Promise<ExpectedPlayer[]> {
  const list = teams ?? (await loadTeamTargets());
  const [{ data: season }, { data: regs }, { data: sessionRegs }, { data: players }, { data: cats }] = await Promise.all([
    db().from("seasons").select("id").eq("is_active", true).maybeSingle(),
    db().from("registrations").select("id, created_at, season_id, player_first_name, player_last_name, player_dob, parent_name, parent_email, program_id, time_slot_template_id, category_id, is_half_season, half_season_ends_on").eq("status", "paid").eq("is_trial", false),
    db().from("session_program_registrations").select("created_at, player_first_name, player_last_name, player_dob, birth_year, parent_name, parent_email, program_slug").eq("status", "paid"),
    db().from("players").select("first_name, last_name, photo_url").not("photo_url", "is", null),
    db().from("birth_categories").select("id, season_id, label")
  ]);
  const catLabel = new Map(((cats ?? []) as any[]).map((c) => [`${c.season_id}|${c.id}`, c.label as string]));
  const photo = new Map(((players ?? []) as any[]).map((p) => [personKey(p.first_name, p.last_name), p.photo_url as string]));
  const out = new Map<string, ExpectedPlayer>();
  const add = (p: Omit<ExpectedPlayer, "key" | "photoUrl" | "teams" | "registrationId" | "createdAt" | "halfUntil" | "programs"> & { registrationId?: string | null; createdAt?: string | null; halfUntil?: string | null; programs?: string[] }, targets: TeamTarget[]) => {
    const key = personKey(p.firstName, p.lastName);
    if (!key || !targets.length) return;
    const prev = out.get(key);
    if (prev) {
      for (const pr of p.programs ?? []) if (!prev.programs.includes(pr)) prev.programs.push(pr);
      if (p.halfUntil && !prev.halfUntil) prev.halfUntil = p.halfUntil;
      if (p.createdAt && (!prev.createdAt || p.createdAt > prev.createdAt)) prev.createdAt = p.createdAt;
      for (const t of targets) if (!prev.teams.some((x) => x.id === t.id)) prev.teams.push(t);
      return;
    }
    out.set(key, { ...p, programs: [...(p.programs ?? [])], registrationId: p.registrationId ?? null, halfUntil: p.halfUntil ?? null, createdAt: p.createdAt ?? null, key, photoUrl: photo.get(key) ?? null, teams: [...targets] });
  };
  for (const r of (regs ?? []) as any[]) {
    if (season?.id && r.season_id !== season.id) continue;
    const years = yearsOf(catLabel.get(`${r.season_id}|${r.category_id}`) ?? r.category_id);
    add(
      { registrationId: r.id, programs: r.program_id ? [String(r.program_id)] : [], halfUntil: r.is_half_season && r.half_season_ends_on ? String(r.half_season_ends_on).slice(0, 10) : null, createdAt: r.created_at ?? null, firstName: String(r.player_first_name).trim(), lastName: String(r.player_last_name).trim(), gender: "female", birthYear: r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : years.length === 1 ? years[0] : null, parentEmail: r.parent_email?.trim() || null, parentName: r.parent_name ?? null },
      teamsFor({ slotId: r.time_slot_template_id, programId: r.program_id, years }, list)
    );
  }
  for (const r of (sessionRegs ?? []) as any[]) {
    add(
      { programs: [`prog:${r.program_slug}`], createdAt: r.created_at ?? null, firstName: String(r.player_first_name).trim(), lastName: String(r.player_last_name).trim(), gender: /garcon/i.test(r.program_slug) ? "male" : "female", birthYear: r.birth_year ?? (r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : null), parentEmail: r.parent_email?.trim() || null, parentName: r.parent_name ?? null },
      teamsFor({ sessionProgramSlug: r.program_slug }, list)
    );
  }
  return [...out.values()];
}

const done_ = (kind: string) => done(kind);
async function done(kind: string): Promise<Set<string>> {
  const { data } = await db().from("mcs_sync_items").select("key").eq("club_id", CLUB_ID).eq("kind", kind);
  return new Set(((data ?? []) as any[]).map((r) => r.key));
}
async function mark(kind: string, key: string, label: string) {
  const { error } = await db().from("mcs_sync_items").upsert({ club_id: CLUB_ID, kind, key, label: label.slice(0, 300) }, { onConflict: "club_id,kind,key", ignoreDuplicates: true });
  // Jamais en silence : une marque refusée ferait refaire (ou renvoyer) la même chose à chaque passage.
  if (error) throw new Error(`Trace MonClubSportif refusée (${kind}) : ${error.message}`);
}

async function fetchPicture(url: string): Promise<{ data: ArrayBuffer; type: string; name: string } | null> {
  try {
    // Photos en stockage privé (Loi 25) : lien signé le temps de la récupérer.
    const direct = await signedPhotoUrl(url);
    if (!direct) return null;
    const res = await fetch(direct, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!/^image\/(jpeg|png|webp)/.test(type)) return null;
    return { data: await res.arrayBuffer(), type, name: `photo.${type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg"}` };
  } catch {
    return null;
  }
}

export async function openRobotSession(): Promise<McsSession | null> {
  const creds = await getRobotCredentials();
  if (!creds) return null;
  const s = new McsSession();
  await s.login(creds.email, creds.password);
  return s;
}

/** Fait tout ce qui manque dans MonClubSportif. `reason` est noté dans le journal (paiement, cron, admin). */
export async function runMcsRobot(opts: { reason: string; unlock?: boolean; dryRun?: boolean } = { reason: "cron" }): Promise<RobotReport> {
  const rules = await getMcsRules();
  const dry = opts.dryRun ?? !rules.robotActive;
  const report: RobotReport = { ok: true, dryRun: dry, added: [], photos: [], opponents: [], unlocked: [], calendar: [], extras: [], staff: [], errors: [] };
  let session: McsSession | null = null;
  try {
    session = await openRobotSession();
  } catch (e) {
    const skipped = e instanceof Error ? e.message : "Connexion impossible.";
    await alertPendingAfterPayment(opts.reason, `le robot n'a pas pu se connecter à MonClubSportif (${skipped})`);
    return { ...report, ok: false, skipped };
  }
  if (!session) {
    const skipped = "Compte robot pas encore enregistré dans l'admin (MonClubSportif → Robot et règles).";
    await alertPendingAfterPayment(opts.reason, "le compte robot n'est pas enregistré dans l'admin");
    return { ...report, ok: false, skipped };
  }

  const teams = (await loadTeamTargets()).filter((t) => t.mcs_team_id && t.mcs_season_id);
  const players = await loadExpectedPlayers(teams);
  const photosDone = await done("photo");
  const inMcs = await done(MEMBER_MARK);
  const seen = async (p: ExpectedPlayer, t: TeamTarget) => {
    const k = memberTeamKey(p.key, t.id);
    if (inMcs.has(k)) return;
    await mark(MEMBER_MARK, k, `${p.firstName} ${p.lastName} · ${t.name}`);
    inMcs.add(k);
  };

  // 1 et 2 : membres et photos, équipe par équipe.
  for (const t of teams) {
    try {
      const roster = await session.roster(t.mcs_team_id!, t.mcs_season_id!);
      for (const p of players.filter((x) => x.teams.some((y) => y.id === t.id))) {
        const memberId = roster.find((m) => sameMemberName(m.name, p.firstName, p.lastName))?.id;
        const wantPhoto = rules.photoAuto && p.photoUrl && !photosDone.has(p.key);
        if (!memberId) {
          if (!rules.inviteOnPaid) continue;
          if (dry) {
            report.added.push(`${p.firstName} ${p.lastName} → ${t.name}${p.parentEmail ? ` (invitation à ${p.parentEmail})` : " (sans courriel de parent)"}`);
            continue;
          }
          const picture = wantPhoto ? await fetchPicture(p.photoUrl!) : null;
          await session.addMember(t.mcs_team_id!, t.mcs_season_id!, { firstName: p.firstName, lastName: p.lastName, gender: p.gender, birthYear: p.birthYear, parentEmail: p.parentEmail, picture, note: "Ajoutée par le robot New Valkyria après le paiement." }, { assignAll: rules.assignAllEvents });
          await seen(p, t);
          report.added.push(`${p.firstName} ${p.lastName} → ${t.name}`);
          if (picture) {
            await mark("photo", p.key, `${p.firstName} ${p.lastName}`);
            photosDone.add(p.key);
            report.photos.push(`${p.firstName} ${p.lastName}`);
          }
        }
        if (memberId) await seen(p, t);
        if (memberId && wantPhoto) {
          if (dry) {
            report.photos.push(`${p.firstName} ${p.lastName} (${t.name})`);
            continue;
          }
          const picture = await fetchPicture(p.photoUrl!);
          if (!picture) continue;
          await session.setPicture(t.mcs_team_id!, t.mcs_season_id!, memberId, picture);
          await mark("photo", p.key, `${p.firstName} ${p.lastName}`);
          photosDone.add(p.key);
          report.photos.push(`${p.firstName} ${p.lastName}`);
        }
      }
      // 4 : présences modifiables en tout temps (une fois par passage complet).
      if (opts.unlock !== false && rules.presenceAlwaysEditable && !dry && (await session.unlockPresences(t.mcs_team_id!))) report.unlocked.push(t.name);
    } catch (e) {
      report.errors.push(`${t.name} : ${e instanceof Error ? e.message : "erreur"}`);
      if (e instanceof McsRobotError && /expir|refusée par MonClubSportif \(courriel/.test(e.message)) break;
    }
  }

  // Demi-saison : la joueuse n'est pas assignée aux activités après sa fin ; si elle paie la 2e partie, tout lui est rendu.
  if (!dry) {
    try {
      report.halfSeason = await syncHalfSeason(session, teams, players);
    } catch (e) {
      report.errors.push(`Demi-saison : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  // Présence par défaut (ex. JP présent à toutes les activités à partir du 9 novembre, s'il n'a rien indiqué).
  if (!dry && rules.defaultPresent.length) {
    try {
      report.presences = await applyDefaultPresence(session, teams, rules);
    } catch (e) {
      report.errors.push(`Présences par défaut : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  // Calendrier : chaque pratique prévue dans le site existe dans MonClubSportif, à la bonne heure.
  if (rules.calendarSync) {
    try {
      const c = await syncCalendar(session, teams, dry);
      report.calendar.push(...c.done);
      report.extras.push(...c.extras);
    } catch (e) {
      report.errors.push(`Calendrier : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  // La direction (JP) est assignée à toutes les activités de toutes les équipes, même celles où il ne va pas.
  if (rules.alwaysAssigned.length) {
    for (const t of teams) {
      try {
        const roster = await session.roster(t.mcs_team_id!, t.mcs_season_id!);
        for (const name of rules.alwaysAssigned) {
          const member = roster.find((m) => personKey(m.name, "") === personKey(name, ""));
          if (!member) continue;
          const missing = await session.missingAssignments(t.mcs_team_id!, t.mcs_season_id!, member.id);
          if (!missing.length) continue;
          if (!dry) await session.assignToAllEvents(t.mcs_team_id!, t.mcs_season_id!, [member.id]);
          report.staff!.push(`${name} → ${t.name} (${missing.length} activité${missing.length > 1 ? "s" : ""})`);
        }
      } catch (e) {
        report.errors.push(`${t.name} (assignations) : ${e instanceof Error ? e.message : "erreur"}`);
      }
    }
  }

  // 3 : le nom de l'adversaire sur chaque match payé.
  if (rules.opponentOnPaid) {
    try {
      report.opponents.push(...(await syncOpponents(session, teams, dry)));
    } catch (e) {
      report.errors.push(`Adversaires : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  report.ok = report.errors.length === 0;
  if (dry) await alertPendingAfterPayment(opts.reason, "le robot est en mode assistant (pas encore activé)");
  if (!dry && (report.added.length || report.photos.length || report.opponents.length || report.unlocked.length || report.calendar.length || report.staff!.length || report.halfSeason?.length || report.presences?.length || report.errors.length)) {
    await logAudit({ actorRole: "admin", actorLabel: "Robot MonClubSportif", action: "mcs_robot_run", entityType: "mcs_teams", entityId: CLUB_ID, entityLabel: opts.reason, after: report as unknown as object }).catch(() => null);
  }
  return report;
}

const MEMBER_MARK = "membre-robot";

/** Demi-saison : retire la joueuse des activités après sa date de fin (marque « demi-saison ») ; si elle n'est plus en
 *  demi-saison (2e partie payée), lui rend tout le calendrier et enlève la marque. */
async function syncHalfSeason(session: McsSession, teams: TeamTarget[], players: ExpectedPlayer[]): Promise<string[]> {
  const out: string[] = [];
  const marked = await done(HALF_MARK);
  const halfKeys = new Set(players.filter((p) => p.halfUntil).map((p) => p.key));
  const touched = players.filter((p) => p.halfUntil || p.teams.some((t) => marked.has(memberTeamKey(p.key, t.id))));
  if (!touched.length) return out;
  for (const t of teams) {
    const mine = touched.filter((p) => p.teams.some((x) => x.id === t.id));
    if (!mine.length) continue;
    const roster = await session.roster(t.mcs_team_id!, t.mcs_season_id!);
    for (const p of mine) {
      const member = roster.find((m) => sameMemberName(m.name, p.firstName, p.lastName));
      if (!member) continue;
      const k = memberTeamKey(p.key, t.id);
      if (halfKeys.has(p.key)) {
        const list = await session.memberAssignmentList(t.mcs_team_id!, t.mcs_season_id!, member.id);
        const after = list.filter((e) => e.checked && e.date && e.date > p.halfUntil!);
        if (after.length) {
          await session.setMemberAssignments(t.mcs_team_id!, t.mcs_season_id!, member.id, list.filter((e) => e.checked && !(e.date && e.date > p.halfUntil!)).map((e) => e.id));
          out.push(`${p.firstName} ${p.lastName} → ${t.name} : retirée de ${after.length} activité(s) après le ${p.halfUntil}`);
        }
        if (!marked.has(k)) await mark(HALF_MARK, k, `${p.firstName} ${p.lastName} · ${t.name}`);
      } else if (marked.has(k)) {
        const n = await session.assignToAllEvents(t.mcs_team_id!, t.mcs_season_id!, [member.id]);
        await db().from("mcs_sync_items").delete().eq("club_id", CLUB_ID).eq("kind", HALF_MARK).eq("key", k);
        out.push(`${p.firstName} ${p.lastName} → ${t.name} : 2e partie payée, ${n} activité(s) rendue(s)`);
      }
    }
  }
  return out;
}
const HALF_MARK = "demi-saison";

/** Chaque jour : toutes les activités de la saison de chaque équipe (grille des présences, toutes les pages), avec leur
 *  date (liste d'assignation de JP, assigné à tout), rangées dans `delivery_events` pour « Promesses tenues ». */
export async function syncDeliveryEvents(): Promise<{ teams: number; events: number; skipped?: string }> {
  const session = await openRobotSession().catch(() => null);
  if (!session) return { teams: 0, events: 0, skipped: "Compte robot pas encore enregistré." };
  const rules = await getMcsRules();
  const teams = (await loadTeamTargets()).filter((t) => t.mcs_team_id && t.mcs_season_id);
  const now = new Date().toISOString();
  let total = 0;
  for (const t of teams) {
    const roster = await session.roster(t.mcs_team_id!, t.mcs_season_id!);
    const director = roster.find((m) => rules.alwaysAssigned.some((n) => personKey(m.name, "") === personKey(n, "")));
    const grid = await session.presencesAll(t.mcs_team_id!, t.mcs_season_id!);
    const dates = new Map(director ? (await session.memberAssignmentList(t.mcs_team_id!, t.mcs_season_id!, director.id)).map((e) => [Number(e.id), e.date]) : []);
    const base = (e: { id: number; title: string }) => ({ club_id: CLUB_ID, team_id: t.id, mcs_event_id: e.id, title: cleanTitle(e.title), kind: eventKind(e.title), cancelled: isCancelled(e.title), removed_at: null, seen_at: now });
    const dateOf = (e: { id: number; title: string }) => dates.get(e.id) ?? titleDate(e.title);
    const withDate = grid.events.filter((e) => dateOf(e)).map((e) => ({ ...base(e), event_date: dateOf(e) }));
    const noDate = grid.events.filter((e) => !dateOf(e)).map(base);
    for (const rows of [withDate, noDate]) {
      if (!rows.length) continue;
      const { error } = await db().from("delivery_events").upsert(rows, { onConflict: "team_id,mcs_event_id" });
      if (error) throw new Error(error.message);
    }
    if (grid.events.length) await db().from("delivery_events").update({ removed_at: now }).eq("team_id", t.id).is("removed_at", null).not("mcs_event_id", "in", `(${grid.events.map((e) => e.id).join(",")})`);
    total += grid.events.length;
  }
  return { teams: teams.length, events: total };
}

/** Met « présent » aux personnes des règles (ex. JP) sur chaque activité à partir de leur date, là où rien n'est indiqué. */
async function applyDefaultPresence(session: McsSession, teams: TeamTarget[], rules: McsRules): Promise<string[]> {
  const out: string[] = [];
  for (const t of teams) {
    const roster = await session.roster(t.mcs_team_id!, t.mcs_season_id!);
    const people = rules.defaultPresent.map((d) => ({ ...d, member: roster.find((m) => personKey(m.name, "") === personKey(d.name, "")) })).filter((d) => d.member);
    if (!people.length) continue;
    const grid = await session.presencesAll(t.mcs_team_id!, t.mcs_season_id!);
    for (const d of people) {
      const row = grid.rows.find((r) => r.memberId === d.member!.id);
      if (!row) continue;
      const dates = new Map((await session.memberAssignmentList(t.mcs_team_id!, t.mcs_season_id!, d.member!.id)).map((e) => [Number(e.id), e.date]));
      let n = 0;
      for (const ev of grid.events) {
        const date = dates.get(ev.id);
        if (!date || date < d.from || row.states[ev.id] !== "unknown") continue;
        await session.setPresence(t.mcs_team_id!, t.mcs_season_id!, ev.id, d.member!.id, "present");
        n++;
      }
      if (n) out.push(`${d.name} présent par défaut → ${t.name} (${n} activité${n > 1 ? "s" : ""})`);
    }
  }
  return out;
}

/** Une fois par jour : seules les personnes permises sont gestionnaires d'équipe, et le personnel (ex. Alex) est rangé
 *  dans « Autre personnel » plutôt que « Entraîneurs ». Retourne ce qui a été corrigé. */
export async function auditMcsAccess(opts: { dryRun?: boolean } = {}): Promise<{ fixed: string[]; skipped?: string }> {
  const rules = await getMcsRules();
  const session = await openRobotSession().catch(() => null);
  if (!session) return { fixed: [], skipped: "Compte robot pas encore enregistré." };
  const allowed = new Set(rules.managers.map((n) => personKey(n, "")));
  const staff = new Set(rules.staffNames.map((n) => personKey(n, "")));
  const fixed: string[] = [];
  for (const t of (await loadTeamTargets()).filter((x) => x.mcs_team_id && x.mcs_season_id)) {
    for (const m of await session.roster(t.mcs_team_id!, t.mcs_season_id!)) {
      const key = personKey(m.name, "");
      const prof = await session.memberProfile(t.mcs_team_id!, t.mcs_season_id!, m.id);
      const patch: { manager?: boolean; type?: "staff" } = {};
      if (prof.manager && !allowed.has(key)) patch.manager = false;
      if (staff.has(key) && prof.type !== "staff") patch.type = "staff";
      if (!Object.keys(patch).length) continue;
      if (!opts.dryRun) await session.updateMember(t.mcs_team_id!, t.mcs_season_id!, m.id, patch);
      fixed.push(`${m.name} (${t.name}) : ${[patch.manager === false ? "accès gestionnaire retiré" : "", patch.type ? "rangé dans Autre personnel" : ""].filter(Boolean).join(", ")}`);
    }
  }
  if (fixed.length && !opts.dryRun) await logAudit({ actorRole: "admin", actorLabel: "Robot MonClubSportif", action: "mcs_access_audit", entityType: "mcs_teams", entityId: CLUB_ID, entityLabel: `${fixed.length} correction(s) d'accès`, after: { fixed } as unknown as object }).catch(() => null);
  return { fixed };
}

/** Nouvelles joueuses payées (14 derniers jours) qui ne sont pas encore dans toutes leurs équipes MonClubSportif. */
export async function getPendingMcsPlayers(days = 14): Promise<PendingMcsPlayer[]> {
  const teams = (await loadTeamTargets()).filter((t) => t.mcs_team_id && t.mcs_season_id);
  const [players, inMcs] = await Promise.all([loadExpectedPlayers(teams), done(MEMBER_MARK)]);
  return pendingMcsPlayers(players, inMcs, new Date(Date.now() - days * 86_400_000).toISOString());
}

/** Après un paiement, si le robot n'a rien pu faire : avis immédiat à JP, une seule fois par joueuse, avec les équipes où
 *  l'ajouter. Une joueuse payée ne reste jamais hors de MonClubSportif sans que JP le sache. */
async function alertPendingAfterPayment(reason: string, why: string): Promise<void> {
  if (!/^paiement/.test(reason)) return;
  try {
    const [pending, warned] = await Promise.all([getPendingMcsPlayers(2), done("avis-mcs")]);
    const fresh = pending.filter((p) => !warned.has(p.key));
    if (!fresh.length) return;
    const list = fresh.map((p) => `<li><strong>${esc(p.name)}</strong> : à ajouter dans ${p.missingTeams.map(esc).join(", ")}${p.parentEmail ? ` (parent : ${esc(p.parentEmail)})` : ""}</li>`).join("");
    const res = await getResendClient().emails.send({
      from: env.resendFrom,
      to: OWNER_NOTIFY_EMAIL,
      subject: `À faire : ${fresh.map((p) => p.name).join(", ")} pas encore dans MonClubSportif`,
      html: `<p>Inscription payée, mais ${esc(why)} : rien n'a été fait dans MonClubSportif.</p><ul>${list}</ul><p><a href="${env.publicSiteUrl}/admin/monclubsportif/robot">Robot et règles</a></p>`
    } as never);
    if ((res as any)?.error) throw new Error(String((res as any).error?.message ?? "envoi refusé"));
    for (const p of fresh) await mark("avis-mcs", p.key, p.name);
  } catch (e) {
    console.error("Avis MCS après paiement impossible", e);
  }
}


const mcsIdOf = (key: string) => {
  const m = key.match(/^(event|game)-(\d+)@/);
  return m ? { type: m[1] as "event" | "game", id: Number(m[2]) } : null;
};
/** Le lien iCal de MonClubSportif nomme tout « event-N », même un match : un Match ou un Tournoi est un « game » chez MCS
 *  (page /calendar/games/N). Sans ça, le robot ne trouvait jamais le match pour y écrire l'adversaire. */
const isGame = (e: { type?: string | null }) => e.type === "Match" || e.type === "Tournoi";

/** Plages payées → nom du club adverse écrit sur le match MCS à la même heure (équipe concernée). */
async function syncOpponents(session: McsSession, teams: TeamTarget[], dry = false): Promise<string[]> {
  const today = todayLocal();
  const [{ data: bookings }, { data: events }, sent] = await Promise.all([
    db().from("match_slot_bookings").select("id, org_name, team_label, slot:match_slots(slot_date, start_time)").eq("status", "paid"),
    db().from("mcs_events").select("team_id, key, event_date, start_time, type, opponent").gte("event_date", today),
    done("adversaire")
  ]);
  const toMin = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : -9999);
  const out: string[] = [];
  for (const b of (bookings ?? []) as any[]) {
    const date = String(b.slot?.slot_date ?? "").slice(0, 10);
    if (!date || date < today || sent.has(b.id)) continue;
    const name = String(b.org_name ?? "").trim();
    if (!name) continue;
    const ev = ((events ?? []) as any[]).find((e) => String(e.event_date).slice(0, 10) === date && Math.abs(toMin(e.start_time) - toMin(String(b.slot.start_time))) <= 15 && isGame(e) && mcsIdOf(e.key) !== null);
    if (!ev) continue;
    if (ev.opponent && ev.opponent.toLowerCase().includes(name.toLowerCase().slice(0, 6))) {
      if (!dry) await mark("adversaire", b.id, name);
      continue;
    }
    const team = teams.find((t) => t.id === ev.team_id);
    const game = mcsIdOf(ev.key);
    if (!team || !game) continue;
    if (dry) {
      out.push(`${name} → ${team.name} (${date})`);
      continue;
    }
    await session.setOpponent(team.mcs_team_id!, team.mcs_season_id!, game.id, name);
    await mark("adversaire", b.id, `${name} · ${date}`);
    out.push(`${name} → ${team.name} (${date})`);
  }
  return out;
}

/* ── Rappels de présence ─────────────────────────────────────────── */

const localDayStartMs = (dateIso: string) => {
  // Minuit à l'heure du club pour cette date (heure normale ou avancée).
  const noonUtc = Date.parse(`${dateIso}T12:00:00Z`);
  const offsetMin = Math.round((Date.parse(new Date(noonUtc).toLocaleString("en-US", { timeZone: TZ })) - Date.parse(new Date(noonUtc).toLocaleString("en-US", { timeZone: "UTC" }))) / 60000);
  return Date.parse(`${dateIso}T00:00:00Z`) - offsetMin * 60000;
};

/** Chaque heure : pour chaque événement MCS dont un rappel est dû (48 h, 24 h, le jour même…), un courriel aux parents
 *  des membres qui n'ont pas encore mis leur présence, avec le lien MonClubSportif. Jamais deux fois le même rappel. */
export async function sendPresenceReminders(now = Date.now(), rules?: McsRules): Promise<{ sent: number; skipped?: string }> {
  const r = rules ?? (await getMcsRules());
  if (!r.robotActive) return { sent: 0, skipped: "Robot pas encore activé (mode assistant)." };
  if (!r.reminders.active) return { sent: 0, skipped: "Rappels désactivés." };
  const viaMcs = r.reminders.channel === "mcs";
  if (!viaMcs && !isEmailConfigured()) return { sent: 0, skipped: "Courriel non configuré." };
  const teams = (await loadTeamTargets()).filter((t) => t.mcs_team_id && t.mcs_season_id);
  const horizon = new Date(now + (Math.max(...r.reminders.hoursBefore, 24) + 2) * 3_600_000).toISOString().slice(0, 10);
  const { data: events } = await db().from("mcs_events").select("team_id, key, event_date, title, type").gte("event_date", todayLocal()).lte("event_date", horizon);
  const due = ((events ?? []) as any[])
    .map((e) => {
      const id = mcsIdOf(e.key);
      const start = Number(String(e.key).split("|")[1]);
      if (!id || !start) return null;
      const stage = dueReminder(start, localDayStartMs(String(e.event_date).slice(0, 10)), now, r);
      return stage ? { ...e, mcsId: id.id, mcsType: isGame(e) ? "game" : id.type, start, stage } : null;
    })
    .filter(Boolean) as any[];
  if (!due.length) return { sent: 0 };

  const session = await openRobotSession();
  if (!session) return { sent: 0, skipped: "Compte robot pas encore enregistré." };
  const players = await loadExpectedPlayers(teams);
  const byKey = new Map(players.map((p) => [p.key, p]));
  const already = await done("rappel");
  // Un seul courriel par parent et par passage, qui liste tout ce qui manque.
  const perParent = new Map<string, { name: string | null; lines: { text: string; url: string }[]; keys: string[] }>();
  // Notification MonClubSportif (choix de JP) : une publication privée par activité, adressée seulement aux membres
  // qui n'ont rien indiqué, sans courriel ; MonClubSportif la pousse dans l'application.
  let posted = 0;
  for (const team of teams) {
    const mine = due.filter((e) => e.team_id === team.id);
    if (!mine.length) continue;
    let grid: PresenceGrid;
    try {
      grid = await session.presences(team.mcs_team_id!, team.mcs_season_id!);
    } catch {
      continue;
    }
    for (const e of mine) {
      if (viaMcs) {
        const who = grid.rows.filter((row) => row.states[e.mcsId] === "unknown" && !already.has(`${e.mcsId}|${row.memberId}|${e.stage}`) && (byKey.get(personKey(row.name, "")) ?? players.find((x) => sameMemberName(row.name, x.firstName, x.lastName))));
        if (!who.length) continue;
        const when = new Date(e.start).toLocaleString("fr-CA", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: TZ });
        const what = String(e.title).replace(/^(Other|Autre|Event|Événement|Hors-concours)\s+/i, "");
        try {
          await session.createPost(team.mcs_team_id!, team.mcs_season_id!, {
            subject: `Rappel : ta présence pour ${what}`,
            html: `<p>Petit rappel : ta présence n'est pas encore indiquée pour <strong>${esc(what)}</strong> (${esc(when)}).</p><p>Indique-la dans l'onglet Présences : tu peux la mettre ou la changer en tout temps, même à la dernière minute. Merci !</p>`,
            to: who.map((w) => w.memberId),
            notify: false
          });
          for (const w of who) await mark("rappel", `${e.mcsId}|${w.memberId}|${e.stage}`, team.name);
          posted++;
        } catch {
          /* on réessaiera au prochain passage si le rappel est encore dû */
        }
        continue;
      }
      for (const row of grid.rows) {
        if (row.states[e.mcsId] !== "unknown") continue;
        const p = byKey.get(personKey(row.name, "")) ?? players.find((x) => sameMemberName(row.name, x.firstName, x.lastName));
        if (!p?.parentEmail) continue;
        const key = `${e.mcsId}|${row.memberId}|${e.stage}`;
        if (already.has(key)) continue;
        const when = new Date(e.start).toLocaleString("fr-CA", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: TZ });
        const url = `${MCS_BASE}/team/${team.mcs_team_id}/seasons/${team.mcs_season_id}/calendar/${e.mcsType === "game" ? "games" : "events"}/${e.mcsId}`;
        const entry = perParent.get(p.parentEmail.toLowerCase()) ?? { name: p.parentName, lines: [], keys: [] };
        entry.lines.push({ text: `${p.firstName} : ${String(e.title).replace(/^(Other|Autre|Event|Événement|Hors-concours)\s+/i, "")} (${when})`, url });
        entry.keys.push(key);
        perParent.set(p.parentEmail.toLowerCase(), entry);
      }
    }
  }
  let sent = posted;
  for (const [to, entry] of perParent) {
    const first = String(entry.name ?? "").trim().split(/\s+/)[0];
    const items = entry.lines.map((l) => `<li>${esc(l.text)} — <a href="${l.url}">indiquer la présence</a></li>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px"><p>Bonjour${first ? ` ${esc(first)}` : ""},</p><p>Petit rappel : la présence n'est pas encore indiquée dans MonClubSportif pour :</p><ul>${items}</ul><p>Vous pouvez la mettre ou la changer en tout temps, même à la dernière minute. Merci, ça nous aide à préparer la pratique et à confirmer les matchs !</p><p>L'équipe New Valkyria</p></div>`;
    const text = `Bonjour${first ? ` ${first}` : ""},\n\nPetit rappel : la présence n'est pas encore indiquée dans MonClubSportif pour :\n${entry.lines.map((l) => `- ${l.text} : ${l.url}`).join("\n")}\n\nVous pouvez la mettre ou la changer en tout temps. Merci !\n\nL'équipe New Valkyria`;
    try {
      const res = await getResendClient().emails.send({ from: env.resendFrom, to, subject: "Rappel : indiquez la présence dans MonClubSportif", html, text } as never);
      if ((res as any)?.error) continue;
      for (const k of entry.keys) await mark("rappel", k, to);
      sent++;
    } catch {
      /* on réessaiera au prochain passage si le rappel est encore dû */
    }
  }
  return { sent };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/* ── Présences : MonClubSportif → site (jeunes et entraîneurs) ─────────── */

const dayIso = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: TZ });
const hm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });

/** L'activité du site pour un événement MCS : même jour, même heure (± 15 min), hors activités de JP ; quand deux
 *  activités sont à la même heure, celle du même type et du même groupe. `create: false` : seulement la trouver. */
async function activityFor(date: string, start: string, end: string | null, location: string, group: string, type = "Pratique", create = true): Promise<string | null> {
  const { data } = await db().from("coach_activities").select("id, start_time, organization, activity_type, title").eq("activity_date", date);
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const game = (x: unknown) => x === "Match" || x === "Tournoi";
  // Une pratique ne tombe jamais sur un match du site à la même heure (et l'inverse).
  const hits = ((data ?? []) as any[]).filter((a) => !a.organization && Math.abs(toMin(String(a.start_time)) - toMin(start)) <= 15 && game(a.activity_type) === game(type));
  const score = (a: any) => (a.activity_type === type ? 2 : 0) + (personKey(String(a.title ?? ""), "") === personKey(group, "") ? 1 : 0);
  const hit = hits.sort((x, y) => score(y) - score(x))[0];
  if (hit) return hit.id;
  if (!create) return null;
  const { createActivityFor } = await import("@/lib/practices-repo");
  return createActivityFor({ date, start, end, location, group, type });
}

export interface McsAttendanceReport {
  players: number;
  coaches: number;
  unmatched: string[];
  /** Présences du site corrigées pour suivre MonClubSportif (un autre état était noté). */
  corrected: number;
  /** Présences ajoutées (MCS avait une réponse, le site rien). */
  created: number;
  /** Pratiques dont la liste des filles attendues a été lue. */
  practices: number;
  /** Pratiques annulées dans MCS (elles ne comptent plus). */
  cancelled: number;
  /** Pratiques de MCS sans activité dans le site (créées seulement quand MCS a une réponse ; jamais en essai à blanc). */
  newActivities: string[];
  /** Le détail des corrections (essai à blanc ou journal). */
  changes: { date: string; group: string; player: string; from: string | null; to: string }[];
  skipped?: string;
}

/** Les présences des jeunes lues dans MonClubSportif. MCS fait foi (JP, 26 nov. 2026) : une réponse (présente, en
 *  retard, absente) devient la présence du site, même si l'éducateur avait marqué autre chose ; sans réponse dans MCS,
 *  la marque de l'éducateur (ou de la borne) reste. Les filles assignées à l'activité MCS (remplaçantes et invitées
 *  comprises) sont les filles attendues (`coach_activities.mcs_expected`) : c'est le dénominateur du pourcentage de
 *  présence. Une pratique annulée dans MCS ne compte pas (`mcs_cancelled`). Les éducateurs (paie) et les convocations
 *  des matchs ne sont lus que pour les événements encore dans le cache du calendrier (aujourd'hui et hier), comme avant.
 *  `days` : combien de jours en arrière (7 chaque soir) ; `today` : les présences du jour avant la pratique ;
 *  `dryRun` : rien n'est écrit, le rapport dit ce qui changerait. */
export async function syncMcsAttendance(opts: { days?: number; now?: number; pages?: number; today?: boolean; dryRun?: boolean } = {}): Promise<McsAttendanceReport> {
  const out: McsAttendanceReport = { players: 0, coaches: 0, unmatched: [], corrected: 0, created: 0, practices: 0, cancelled: 0, newActivities: [], changes: [] };
  const rules = await getMcsRules();
  if (!rules.robotActive) return { ...out, skipped: "Robot pas encore activé (mode assistant)." };
  const session = await openRobotSession();
  if (!session) return { ...out, skipped: "Compte robot pas encore enregistré." };
  const dry = !!opts.dryRun;
  // « today » (JP, 18 nov. 2026) : avant la pratique, les présences du jour (absentes en X, joueuses ajoutées) entrent
  // dans le site pour que la borne du sondage les suive ; seulement les jeunes et les pratiques, jamais la paie.
  const now = opts.now ?? Date.now();
  const todayIso = dayIso(now);
  const since = opts.today ? localDayStartMs(todayIso) : now - (opts.days ?? 7) * 86_400_000;
  const until = opts.today ? localDayStartMs(todayIso) + 86_400_000 : now;
  const sinceIso = opts.today ? todayIso : dayIso(since);
  const allTeams = (await loadTeamTargets()).filter((t) => t.mcs_team_id && t.mcs_season_id);
  const players = await loadExpectedPlayers(allTeams);
  const [{ data: coaches }, { data: events }, { data: ahead }] = await Promise.all([
    db().from("coaches").select("id, first_name, last_name").eq("status", "active"),
    db().from("mcs_events").select("team_id, key, event_date, location, type, end_time, title").gte("event_date", sinceIso).lte("event_date", todayIso),
    // Événements passés sortis du cache : l'heure de fin et le lieu viennent des prochains événements de la même équipe à la même heure.
    db().from("mcs_events").select("team_id, start_time, end_time, location").gt("event_date", todayIso).limit(2000)
  ]);
  const usual = (teamId: string, start: string) => {
    const same = ((ahead ?? []) as any[]).filter((x) => x.team_id === teamId && x.end_time);
    const hit = same.find((x) => String(x.start_time ?? "").slice(0, 5) === start) ?? null;
    const startMin = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
    const dur = hit ? Number(String(hit.end_time).slice(0, 2)) * 60 + Number(String(hit.end_time).slice(3, 5)) - (Number(String(hit.start_time).slice(0, 2)) * 60 + Number(String(hit.start_time).slice(3, 5))) : 90;
    const end = Math.min(23 * 60 + 59, startMin + (dur > 0 ? dur : 90));
    return { end: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`, location: hit?.location ?? same[0]?.location ?? "" };
  };
  const withEvents = new Set(((events ?? []) as any[]).map((e) => e.team_id));
  const teams = opts.today ? allTeams.filter((t) => withEvents.has(t.id)) : allTeams;
  const byId = new Map<number, any>();
  for (const e of (events ?? []) as any[]) {
    const id = mcsIdOf(e.key)?.id;
    const [, s, en] = String(e.key).split("|");
    // La clé ne porte que le début : la fin vient de la colonne end_time (sans elle, l'activité ne pouvait pas être créée).
    if (id) byId.set(id, { ...e, start: Number(s), endHm: Number(en) ? hm(Number(en)) : e.end_time ? String(e.end_time).slice(0, 5) : null });
  }
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const regName = new Map(players.filter((p) => p.registrationId).map((p) => [p.registrationId!, `${p.firstName} ${p.lastName}`.trim()]));
  const unmatched = new Set<string>();
  // Une activité du site peut recevoir plusieurs équipes MCS (deux groupes à la même heure) : on additionne avant d'écrire.
  const acts = new Map<string, { date: string; group: string; eventIds: number[]; members: Map<string, string | undefined> }>();
  const cancelledSlots: { date: string; start: string; group: string }[] = [];
  let readFailed = false;
  const strong = (s: string | undefined) => !!attendanceFromMcs(s);

  for (const t of teams) {
    let grid: PresenceGrid;
    try {
      // Avant la pratique, la grille « à venir » (page 0) porte les présences du jour ; le soir, les pages de la période.
      grid = opts.today ? await session.upcomingPresences(t.mcs_team_id!, t.mcs_season_id!) : await session.presencesBetween(t.mcs_team_id!, t.mcs_season_id!, sinceIso, todayIso);
    } catch {
      readFailed = true;
      continue;
    }
    for (const c of grid.cancelled ?? []) if (c.date && c.start && c.date >= sinceIso && c.date <= todayIso) cancelledSlots.push({ date: c.date, start: c.start, group: t.name });
    for (const ev of grid.events) {
      const e = byId.get(ev.id);
      const date = e ? String(e.event_date).slice(0, 10) : ev.date ?? null;
      const startHm = e?.start ? hm(e.start) : ev.start ?? null;
      if (!date || !startHm) continue;
      const startMs = e?.start ?? localDayStartMs(date) + toMin(startHm) * 60_000;
      if (startMs > until || startMs < since) continue;
      if (ev.cancelled || isCancelledTitle(e?.title)) {
        cancelledSlots.push({ date, start: startHm, group: t.name });
        continue;
      }
      // Match ou tournoi : la présence des éducateurs compte pour leur paie ; celle des jeunes devient la convocation du match.
      const game = e ? e.type === "Match" || e.type === "Tournoi" : isGameTitle(ev.title);
      if (opts.today && game) continue;
      let activityId: string | null = null;
      const members: { registrationId: string; state: string | undefined }[] = [];
      for (const row of grid.rows) {
        if (!(ev.id in row.states)) continue; // pas assignée à cet événement
        const state = row.states[ev.id];
        const status = attendanceFromMcs(state);
        const coach = ((coaches ?? []) as any[]).find((c) => sameMemberName(row.name, c.first_name, c.last_name));
        if (coach) {
          // Paie : seulement les événements du cache du calendrier (comme avant), jamais en essai à blanc ni le matin.
          if (!status || !e || opts.today || dry) continue;
          activityId ??= await activityFor(date, startHm, e.endHm, e.location ?? "", t.name, game ? "Match" : "Pratique");
          if (!activityId) continue;
          const { data: asg } = await db().from("coach_assignments").select("id, confirmed, confirmed_by, status").eq("activity_id", activityId).eq("coach_id", coach.id).maybeSingle();
          // « Je n'étais pas là » déclaré par l'éducateur dans le portail (ex. absent au 2e bloc) : MonClubSportif ne le
          // remet pas présent (JP, 20 nov. 2026).
          if (asg?.status === "absent" && asg.confirmed_by === "educateur") continue;
          const patch: Record<string, unknown> = { status: status === "absent" ? "absent" : "present", updated_at: new Date().toISOString() };
          if (status !== "absent" && !asg?.confirmed) Object.assign(patch, { confirmed: true, confirmed_at: new Date().toISOString(), confirmed_by: "MonClubSportif" });
          // Jamais en silence : cette présence est le « punch » de la paie de l'éducateur.
          const { error } = asg
            ? await db().from("coach_assignments").update(patch).eq("id", asg.id)
            : status !== "absent"
              ? await db().from("coach_assignments").insert({ activity_id: activityId, coach_id: coach.id, arrival_time: hm(e.start), departure_time: e.endHm, ...patch })
              : { error: null };
          if (error) throw new Error(`Présence de ${row.name} refusée par la base : ${error.message}`);
          out.coaches++;
          continue;
        }
        const p = players.find((x) => sameMemberName(row.name, x.firstName, x.lastName));
        if (!p?.registrationId) {
          if (status) unmatched.add(row.name);
          continue;
        }
        if (game) {
          // Joueuses d'un match (JP, 22 nov. 2026) : leur présence MCS devient la convocation du match (présente ou
          // absente), pour que la fiche « Évaluer le match » montre qui était là. Jamais dans les présences des
          // pratiques (points, bulletin). Une joueuse déjà évaluée par un éducateur n'est pas remise absente.
          if (!status || !e || dry) continue;
          activityId ??= await activityFor(date, startHm, e.endHm, e.location ?? "", t.name, "Match");
          if (!activityId) continue;
          if (status === "absent") {
            const { data: done } = await db().from("match_player_evaluations").select("id").eq("activity_id", activityId).eq("registration_id", p.registrationId).limit(1);
            if ((done ?? []).length) continue;
          }
          const { setConvocation } = await import("@/lib/match-repo");
          await setConvocation(activityId, p.registrationId, status === "absent" ? "absent" : "confirmed");
          out.players++;
          continue;
        }
        members.push({ registrationId: p.registrationId, state });
      }
      // « Vendredi Solo » (l'horaire personnel de JP, séances une à une) n'est pas une pratique de groupe : pas de présence.
      const personal = t.kind === "programme" && !(t.session_program_slugs ?? []).length && !(t.program_ids ?? []).length;
      if (game || personal || !members.length) continue;
      // La pratique du site : trouvée, ou créée quand MCS a au moins une réponse (jamais en essai à blanc).
      const guess = e?.endHm ? null : usual(t.id, startHm);
      const found = await activityFor(date, startHm, e?.endHm ?? guess?.end ?? null, e?.location || guess?.location || "", t.name, "Pratique", !dry && members.some((m) => strong(m.state)));
      const key = found ?? `nouvelle:${date}|${startHm}|${t.name}`;
      const acc = acts.get(key) ?? { date, group: t.name, eventIds: [], members: new Map<string, string | undefined>() };
      acc.eventIds.push(ev.id);
      for (const m of members) if (!acc.members.has(m.registrationId) || strong(m.state)) acc.members.set(m.registrationId, m.state);
      acts.set(key, acc);
    }
  }

  const readAt = new Date().toISOString();
  for (const [activityId, acc] of acts) {
    const real = !activityId.startsWith("nouvelle:");
    if (!real) out.newActivities.push(`${acc.date} ${acc.group}`);
    const { data: rows } = real ? await db().from("activity_player_attendance").select("registration_id, status, status_source").eq("activity_id", activityId) : { data: [] };
    const existing = new Map(((rows ?? []) as any[]).map((r) => [r.registration_id as string, { status: String(r.status), source: (r.status_source ?? null) as string | null }]));
    const plan = mcsAttendancePlan([...acc.members].map(([registrationId, state]) => ({ registrationId, state })), existing);
    out.practices++;
    out.corrected += plan.corrected;
    out.created += plan.created;
    for (const w of plan.writes) {
      if (w.changed || w.created) out.changes.push({ date: acc.date, group: acc.group, player: regName.get(w.registrationId) ?? w.registrationId, from: existing.get(w.registrationId)?.status ?? null, to: w.status });
    }
    out.players += plan.writes.length;
    if (dry || !real) continue;
    if (plan.writes.length) {
      const { error } = await db()
        .from("activity_player_attendance")
        .upsert(plan.writes.map((w) => ({ activity_id: activityId, registration_id: w.registrationId, status: w.status, status_source: "mcs", mcs_status: w.mcsStatus, mcs_read_at: readAt, updated_at: readAt })), { onConflict: "activity_id,registration_id" });
      if (error) throw new Error(error.message);
    }
    for (const n of plan.notes) await db().from("activity_player_attendance").update({ mcs_status: n.mcsStatus, mcs_read_at: readAt }).eq("activity_id", activityId).eq("registration_id", n.registrationId);
    // Les filles attendues : remplacées par la lecture (ajoutées à l'ancienne liste si une équipe n'a pas pu être lue).
    const { data: act } = await db().from("coach_activities").select("mcs_expected, mcs_event_ids").eq("id", activityId).maybeSingle();
    const expected = readFailed ? [...new Set([...((act?.mcs_expected ?? []) as string[]), ...plan.expected])] : plan.expected;
    const eventIds = [...new Set([...(readFailed ? ((act?.mcs_event_ids ?? []) as number[]).map(Number) : []), ...acc.eventIds])];
    await db().from("coach_activities").update({ mcs_expected: expected, mcs_event_ids: eventIds, mcs_cancelled: false, mcs_read_at: readAt }).eq("id", activityId);
  }

  // Pratiques annulées dans MonClubSportif : la pratique du site à la même heure ne compte plus (si aucune autre équipe
  // n'a d'événement actif à cette heure-là).
  for (const c of cancelledSlots) {
    const id = await activityFor(c.date, c.start, null, "", c.group, "Pratique", false);
    if (!id || acts.has(id)) continue;
    out.cancelled++;
    if (!dry) await db().from("coach_activities").update({ mcs_cancelled: true, mcs_read_at: readAt }).eq("id", id);
  }

  out.unmatched = [...unmatched];
  if (!dry && (out.players || out.coaches)) await logAudit({ actorRole: "admin", actorLabel: "Robot MonClubSportif", action: "mcs_attendance_sync", entityType: "activity_player_attendance", entityId: CLUB_ID, entityLabel: `${out.players} présences de jeunes (${out.corrected} corrigées, ${out.created} ajoutées), ${out.coaches} d'entraîneurs`, after: { unmatched: out.unmatched, changes: out.changes.slice(0, 200) } }).catch(() => null);
  return out;
}

/** Les pratiques prévues dans le site (plages de la saison, programmes à dates fixes) pour les 45 prochains jours,
 *  équipe par équipe, comparées à MonClubSportif : création et remise à l'heure ; le reste est signalé. */
export async function syncCalendar(session: McsSession, teams: TeamTarget[], dry: boolean): Promise<{ done: string[]; extras: string[] }> {
  const { listPractices } = await import("@/lib/practices-repo");
  const today = todayLocal();
  const to = new Date(Date.parse(`${today}T12:00:00Z`) + 45 * 86_400_000).toISOString().slice(0, 10);
  const [practices, { data: evs }] = await Promise.all([listPractices({ from: today, to }), db().from("mcs_events").select("team_id, key, event_date, start_time, end_time, title, type, location").gte("event_date", today).lte("event_date", to)]);
  const done: string[] = [];
  const extras: string[] = [];
  const fresh: string[] = [];
  const seenNew = await done_("nouvelle-activite");
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  for (const t of teams) {
    if (!t.slot_ids.length && !t.session_program_slugs.length) continue; // aucune source dans le site : on ne touche à rien
    const site = practices
      .filter((p) => !p.organization && ((p.key.startsWith("tpl-") && t.slot_ids.some((id) => p.key.startsWith(`tpl-${id}-`))) || t.session_program_slugs.some((slug) => p.key.startsWith(`prog-${slug}-`))))
      .map((p) => ({ date: p.date, start: p.start, end: p.end, title: p.group, location: p.location }))
      // Deux plages (deux catégories d'âge) à la même heure dans la même équipe = une seule pratique dans MonClubSportif.
      .filter((p, i, a) => a.findIndex((x) => x.date === p.date && x.start === p.start) === i);
    const mine = ((evs ?? []) as any[]).filter((e) => e.team_id === t.id);
    const mcs = mine
      .map((e) => ({ id: mcsIdOf(e.key)?.id ?? 0, kind: mcsIdOf(e.key)?.type, date: String(e.event_date).slice(0, 10), start: String(e.start_time ?? "").slice(0, 5), end: e.end_time ? String(e.end_time).slice(0, 5) : null, title: e.title as string, isPractice: e.type !== "Match" && e.type !== "Tournoi" && !/st-?gabriel|elevate|finition|solo|annul/i.test(e.title) })) // une pratique « ANNULÉE » dans MCS ne revient jamais dans l'horaire du site
      .filter((e) => e.id && e.kind === "event");
    const fallback = (() => {
      const counts = new Map<string, number>();
      for (const e of mine) if (e.location) counts.set(e.location, (counts.get(e.location) ?? 0) + 1);
      return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    })();
    const diff = calendarDiff(site, mcs);
    for (const c of diff.create) {
      const label = `${t.name} : pratique ajoutée ${fmt(c.date)} ${c.start}–${c.end ?? ""}`;
      if (!dry) await session.createEvent(t.mcs_team_id!, t.mcs_season_id!, { title: `Pratique – ${c.title}`, type: c.title, date: c.date, start: c.start, end: c.end ?? c.start, location: c.location, fallbackLocation: fallback, comments: "Ajoutée par le robot New Valkyria (horaire du site)." });
      done.push(label);
    }
    for (const r of diff.retime) {
      const label = `${t.name} : ${fmt(r.to.date)} ${r.from} → ${r.to.start}–${r.to.end ?? ""}`;
      if (!dry && r.to.end) await session.retimeEvent(t.mcs_team_id!, t.mcs_season_id!, r.id, r.to.date, r.to.start, r.to.end);
      done.push(label);
    }
    for (const e of diff.extra) {
      const what = e.title.replace(/^(Event|Événement)\s+/i, "");
      const known = seenNew.has(String(e.id));
      // Lien entre les deux plateformes : une pratique ajoutée dans MonClubSportif pour un programme à dates fixes entre
      // dans l'horaire du site (pages des familles, promesses tenues). Pour un groupe de saison, JP est averti.
      const slug = t.session_program_slugs.length === 1 ? t.session_program_slugs[0] : null;
      if (!dry && slug) {
        const loc = mine.find((x) => mcsIdOf(x.key)?.id === e.id)?.location ?? null;
        const { data: exists } = await db().from("session_program_dates").select("id").eq("program_slug", slug).eq("session_date", e.date).limit(1);
        if (!exists?.length) {
          const { error } = await db().from("session_program_dates").insert({ program_slug: slug, session_date: e.date, start_time: e.start, end_time: e.end ?? e.start, location: loc });
          if (!error) done.push(`${t.name} : ${fmt(e.date)} ${e.start} « ${what} » ajoutée à l'horaire du site (créée dans MonClubSportif)`);
        }
      } else extras.push(`${t.name} : ${fmt(e.date)} ${e.start} « ${what} » n'est pas dans l'horaire du site`);
      if (!known && !dry) {
        fresh.push(`${t.name} : ${fmt(e.date)} ${e.start} « ${what} »${slug ? " (ajoutée à l'horaire du site)" : ""}`);
        await mark("nouvelle-activite", String(e.id), `${t.name} · ${e.date} ${e.start}`);
        seenNew.add(String(e.id));
      }
    }
  }
  // JP averti (une seule fois par activité) de toute activité ajoutée dans MonClubSportif hors de l'horaire du site.
  if (fresh.length) {
    await getResendClient()
      .emails.send({ from: env.resendFrom, to: OWNER_NOTIFY_EMAIL, subject: `MonClubSportif : ${fresh.length} nouvelle${fresh.length > 1 ? "s" : ""} activité${fresh.length > 1 ? "s" : ""}`, html: `<p>Ajoutée${fresh.length > 1 ? "s" : ""} dans MonClubSportif (hors de l'horaire du site) :</p><ul>${fresh.map((f) => `<li>${esc(f)}</li>`).join("")}</ul><p>Les programmes à dates fixes sont mis à jour tout seuls ; « Promesses tenues » en tient compte au prochain calcul.</p>` } as never)
      .catch(() => null);
  }
  return { done, extras };
}

/* ── Éducateurs : MonClubSportif → horaire du site (assignés d'avance, 2 par pratique) ─────────── */

/** Deux fois par jour (cron « pratiques ») : pour chaque pratique des 3 prochaines semaines, les éducateurs « présents »
 *  dans MonClubSportif sont assignés à la pratique du site (portail, horaire, paie), ceux qui se mettent absents passent
 *  à « absent » (pas payés). S'il n'y a pas 2 éducateurs présents, une tâche pour JP, due 3 jours avant la pratique,
 *  cochée toute seule quand le 2e dit présent ; un courriel à JP pour chaque nouveau manque. Règles : coach-staffing.ts. */
export async function syncCoachSchedule(opts: { days?: number; now?: number; dryRun?: boolean } = {}): Promise<{ slots: number; inserted: number; absent: number; present: number; removed: number; short: string[]; newShort: string[]; skipped?: string }> {
  const { ASSIGNED_BY_MCS, STAFFING_HORIZON_DAYS, assignmentPlan, coachIntent, mergeSlotCoaches, shortageDue, shortageRef, shortageTask, staffingOf } = await import("@/lib/coach-staffing");
  const out = { slots: 0, inserted: 0, absent: 0, present: 0, removed: 0, short: [] as string[], newShort: [] as string[] };
  const rules = await getMcsRules();
  if (!rules.robotActive) return { ...out, skipped: "Robot pas encore activé (mode assistant)." };
  const session = await openRobotSession();
  if (!session) return { ...out, skipped: "Compte robot pas encore enregistré." };
  const dry = opts.dryRun ?? false;
  const now = opts.now ?? Date.now();
  const today = dayIso(now);
  const until = dayIso(now + (opts.days ?? STAFFING_HORIZON_DAYS) * 86_400_000);
  // Les équipes de l'académie (pas « Vendredi Solo », l'horaire personnel de JP).
  const teams = (await loadTeamTargets()).filter((t) => t.mcs_team_id && t.mcs_season_id && (t.kind !== "programme" || (t.session_program_slugs ?? []).length > 0));
  const [{ data: coaches }, { data: events }] = await Promise.all([
    db().from("coaches").select("id, first_name, last_name").eq("status", "active"),
    db().from("mcs_events").select("team_id, key, event_date, start_time, end_time, title, type").eq("type", "Pratique").gte("event_date", today).lte("event_date", until)
  ]);
  const { listPractices, mergeSameSlot, createActivityFor } = await import("@/lib/practices-repo");
  const practices = mergeSameSlot(await listPractices({ from: today, to: until })).filter((p) => !p.organization);
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  type Slot = { practice: (typeof practices)[number]; rows: import("@/lib/coach-staffing").SlotCoach[]; read: boolean };
  const slots = new Map<string, Slot>();
  for (const t of teams) {
    const evs = ((events ?? []) as any[]).filter((e) => e.team_id === t.id && !/annul/i.test(String(e.title ?? "")) && Number(String(e.key).split("|")[1]) > now);
    if (!evs.length) continue;
    let grid: PresenceGrid;
    try {
      grid = await session.presences(t.mcs_team_id!, t.mcs_season_id!, 5);
    } catch {
      continue;
    }
    for (const e of evs) {
      const id = mcsIdOf(String(e.key))?.id;
      const date = String(e.event_date).slice(0, 10);
      const start = String(e.start_time).slice(0, 5);
      const practice = practices.find((p) => p.date === date && Math.abs(toMin(p.start) - toMin(start)) <= 15);
      if (!id || !practice) continue;
      const slot = slots.get(practice.key) ?? { practice, rows: [], read: false };
      if (grid.events.some((x) => x.id === id)) slot.read = true;
      for (const row of grid.rows) {
        const coach = ((coaches ?? []) as any[]).find((c) => sameMemberName(row.name, c.first_name, c.last_name));
        if (coach && row.states[id] !== undefined) slot.rows.push({ coachId: coach.id, name: `${coach.first_name} ${coach.last_name}`, intent: coachIntent(row.states[id]) });
      }
      slots.set(practice.key, slot);
    }
  }
  const { data: openTasks } = await db().from("team_tasks").select("ref").eq("club_id", CLUB_ID).like("ref", "educateurs:%").in("status", ["a_faire", "en_cours"]);
  const openRefs = new Set(((openTasks ?? []) as any[]).map((r) => r.ref));
  const { syncRefTask } = await import("@/lib/team-tasks-repo");
  for (const { practice: p, rows, read } of slots.values()) {
    if (!read) continue; // la grille MCS de cette pratique n'a pas pu être lue : on ne conclut rien
    out.slots++;
    const merged = mergeSlotCoaches(rows);
    let activityId = p.activityId;
    const { data: existing } = activityId
      ? await db().from("coach_assignments").select("id, coach_id, status, assigned_by, confirmed, paid").eq("activity_id", activityId)
      : { data: [] };
    const plan = assignmentPlan(((existing ?? []) as any[]).map((a) => ({ id: a.id, coachId: a.coach_id, status: a.status, assignedBy: a.assigned_by, confirmed: !!a.confirmed, paid: !!a.paid })), merged);
    if (!dry) {
      if (plan.insert.length && !activityId) activityId = await createActivityFor({ date: p.date, start: p.start, end: p.end, location: p.location, group: p.group });
      if (plan.insert.length) {
        const { error } = await db().from("coach_assignments").insert(plan.insert.map((coachId) => ({ activity_id: activityId, coach_id: coachId, status: "present", arrival_time: p.start, departure_time: p.end, assigned_by: ASSIGNED_BY_MCS })));
        if (error) throw new Error(`Assignation refusée par la base : ${error.message}`);
      }
      const stamp = new Date().toISOString();
      if (plan.absent.length) await db().from("coach_assignments").update({ status: "absent", updated_at: stamp }).in("id", plan.absent);
      if (plan.present.length) await db().from("coach_assignments").update({ status: "present", updated_at: stamp }).in("id", plan.present);
      if (plan.remove.length) await db().from("coach_assignments").delete().in("id", plan.remove);
    }
    out.inserted += plan.insert.length;
    out.absent += plan.absent.length;
    out.present += plan.present.length;
    out.removed += plan.remove.length;
    const s = staffingOf(merged);
    const ref = shortageRef(p.date, p.start);
    if (s.ok) {
      if (!dry && openRefs.has(ref)) await syncRefTask(ref, { title: "", done: true, doneNote: `${s.coming.length} éducateurs présents dans MonClubSportif` });
      continue;
    }
    const task = shortageTask({ date: p.date, start: p.start, group: p.group, coaches: merged });
    out.short.push(task.title);
    if (!openRefs.has(ref)) out.newShort.push(`${task.title}\n${task.details}`);
    if (!dry) await syncRefTask(ref, { ...task, due: shortageDue(p.date, today) });
  }
  if (!dry && out.newShort.length && isEmailConfigured()) {
    const n = out.newShort.length;
    await getResendClient()
      .emails.send({
        from: env.resendFrom,
        to: OWNER_NOTIFY_EMAIL,
        subject: `Éducateurs : ${n} pratique${n > 1 ? "s" : ""} sans 2 éducateurs présents`,
        html: `<div style="font-family:-apple-system,Arial,sans-serif;line-height:1.55;color:#161419;max-width:620px"><p>Il faut 2 éducateurs par pratique. D'après MonClubSportif, ${n > 1 ? "ces pratiques n'en ont" : "cette pratique n'en a"} pas encore 2 présents :</p><ul style="padding-left:18px">${out.newShort.map((s) => { const [t, ...d] = s.split("\n"); return `<li style="margin-bottom:8px"><strong>${esc(t)}</strong><br><span style="color:#555">${d.map(esc).join("<br>")}</span></li>`; }).join("")}</ul><p>Une tâche par pratique est dans Mes tâches (Aujourd'hui), due 3 jours avant ; elle se coche toute seule quand le 2e éducateur met « présent » dans MonClubSportif.</p><p><a href="${env.publicSiteUrl}/admin/aujourdhui" style="display:inline-block;background:#5b2a86;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Ouvrir Aujourd'hui</a></p></div>`
      } as never)
      .catch(() => null);
  }
  if (!dry && (out.inserted || out.absent || out.present || out.removed || out.newShort.length)) {
    await logAudit({ actorRole: "admin", actorLabel: "Robot MonClubSportif", action: "mcs_coach_schedule", entityType: "coach_assignments", entityId: CLUB_ID, entityLabel: `${out.inserted} assignations, ${out.absent} absences, ${out.short.length} pratiques sans 2 éducateurs`, after: out }).catch(() => null);
  }
  return out;
}

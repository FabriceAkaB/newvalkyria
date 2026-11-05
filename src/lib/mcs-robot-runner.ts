import { logAudit } from "@/lib/audit-repo";
import { CLUB, CLUB_ID } from "@/lib/club";
import { env } from "@/lib/env";
import { McsRobotError, McsSession, type PresenceGrid } from "@/lib/mcs-robot";
import { getRobotCredentials } from "@/lib/mcs-robot-config";
import { attendanceFromMcs, calendarDiff, dueReminder, personKey, sameMemberName, teamsFor, yearsOf, type McsRules, type TeamTarget } from "@/lib/mcs-rules";
import { getMcsRules } from "@/lib/mcs-rules-repo";
import { MCS_BASE } from "@/lib/mcs-site-map";
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
  firstName: string;
  lastName: string;
  gender: "female" | "male";
  birthYear: number | null;
  parentEmail: string | null;
  parentName: string | null;
  photoUrl: string | null;
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
    db().from("registrations").select("id, season_id, player_first_name, player_last_name, player_dob, parent_name, parent_email, program_id, time_slot_template_id, category_id").eq("status", "paid").eq("is_trial", false),
    db().from("session_program_registrations").select("player_first_name, player_last_name, player_dob, birth_year, parent_name, parent_email, program_slug").eq("status", "paid"),
    db().from("players").select("first_name, last_name, photo_url").not("photo_url", "is", null),
    db().from("birth_categories").select("id, season_id, label")
  ]);
  const catLabel = new Map(((cats ?? []) as any[]).map((c) => [`${c.season_id}|${c.id}`, c.label as string]));
  const photo = new Map(((players ?? []) as any[]).map((p) => [personKey(p.first_name, p.last_name), p.photo_url as string]));
  const out = new Map<string, ExpectedPlayer>();
  const add = (p: Omit<ExpectedPlayer, "key" | "photoUrl" | "teams" | "registrationId"> & { registrationId?: string | null }, targets: TeamTarget[]) => {
    const key = personKey(p.firstName, p.lastName);
    if (!key || !targets.length) return;
    const prev = out.get(key);
    if (prev) {
      for (const t of targets) if (!prev.teams.some((x) => x.id === t.id)) prev.teams.push(t);
      return;
    }
    out.set(key, { ...p, registrationId: p.registrationId ?? null, key, photoUrl: photo.get(key) ?? null, teams: [...targets] });
  };
  for (const r of (regs ?? []) as any[]) {
    if (season?.id && r.season_id !== season.id) continue;
    const years = yearsOf(catLabel.get(`${r.season_id}|${r.category_id}`) ?? r.category_id);
    add(
      { registrationId: r.id, firstName: String(r.player_first_name).trim(), lastName: String(r.player_last_name).trim(), gender: "female", birthYear: r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : years.length === 1 ? years[0] : null, parentEmail: r.parent_email?.trim() || null, parentName: r.parent_name ?? null },
      teamsFor({ slotId: r.time_slot_template_id, programId: r.program_id, years }, list)
    );
  }
  for (const r of (sessionRegs ?? []) as any[]) {
    add(
      { firstName: String(r.player_first_name).trim(), lastName: String(r.player_last_name).trim(), gender: /garcon/i.test(r.program_slug) ? "male" : "female", birthYear: r.birth_year ?? (r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : null), parentEmail: r.parent_email?.trim() || null, parentName: r.parent_name ?? null },
      teamsFor({ sessionProgramSlug: r.program_slug }, list)
    );
  }
  return [...out.values()];
}

async function done(kind: string): Promise<Set<string>> {
  const { data } = await db().from("mcs_sync_items").select("key").eq("club_id", CLUB_ID).eq("kind", kind);
  return new Set(((data ?? []) as any[]).map((r) => r.key));
}
async function mark(kind: string, key: string, label: string) {
  await db().from("mcs_sync_items").upsert({ club_id: CLUB_ID, kind, key, label: label.slice(0, 300) }, { onConflict: "club_id,kind,key", ignoreDuplicates: true });
}

async function fetchPicture(url: string): Promise<{ data: ArrayBuffer; type: string; name: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
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
    return { ...report, ok: false, skipped: e instanceof Error ? e.message : "Connexion impossible." };
  }
  if (!session) return { ...report, ok: false, skipped: "Compte robot pas encore enregistré dans l'admin (MonClubSportif → Équipes)." };

  const teams = (await loadTeamTargets()).filter((t) => t.mcs_team_id && t.mcs_season_id);
  const players = await loadExpectedPlayers(teams);
  const photosDone = await done("photo");

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
          report.added.push(`${p.firstName} ${p.lastName} → ${t.name}`);
          if (picture) {
            await mark("photo", p.key, `${p.firstName} ${p.lastName}`);
            photosDone.add(p.key);
            report.photos.push(`${p.firstName} ${p.lastName}`);
          }
        } else if (wantPhoto) {
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
  if (!dry && (report.added.length || report.photos.length || report.opponents.length || report.unlocked.length || report.calendar.length || report.staff!.length || report.errors.length)) {
    await logAudit({ actorRole: "admin", actorLabel: "Robot MonClubSportif", action: "mcs_robot_run", entityType: "mcs_teams", entityId: CLUB_ID, entityLabel: opts.reason, after: report as unknown as object }).catch(() => null);
  }
  return report;
}

const mcsIdOf = (key: string) => {
  const m = key.match(/^(event|game)-(\d+)@/);
  return m ? { type: m[1] as "event" | "game", id: Number(m[2]) } : null;
};

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
    const ev = ((events ?? []) as any[]).find((e) => String(e.event_date).slice(0, 10) === date && Math.abs(toMin(e.start_time) - toMin(String(b.slot.start_time))) <= 15 && (e.type === "Match" || e.type === "Tournoi") && mcsIdOf(e.key)?.type === "game");
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
  if (!isEmailConfigured()) return { sent: 0, skipped: "Courriel non configuré." };
  const teams = (await loadTeamTargets()).filter((t) => t.mcs_team_id && t.mcs_season_id);
  const horizon = new Date(now + (Math.max(...r.reminders.hoursBefore, 24) + 2) * 3_600_000).toISOString().slice(0, 10);
  const { data: events } = await db().from("mcs_events").select("team_id, key, event_date, title, type").gte("event_date", todayLocal()).lte("event_date", horizon);
  const due = ((events ?? []) as any[])
    .map((e) => {
      const id = mcsIdOf(e.key);
      const start = Number(String(e.key).split("|")[1]);
      if (!id || !start) return null;
      const stage = dueReminder(start, localDayStartMs(String(e.event_date).slice(0, 10)), now, r);
      return stage ? { ...e, mcsId: id.id, mcsType: id.type, start, stage } : null;
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
  let sent = 0;
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

/** L'activité du site pour un événement MCS passé : même jour, même heure (± 15 min), hors activités de JP ;
 *  créée au besoin (même règle que le sondage de fin) pour que la présence ait où aller. */
async function activityFor(date: string, start: string, end: string | null, location: string, group: string): Promise<string> {
  const { data } = await db().from("coach_activities").select("id, start_time, organization").eq("activity_date", date);
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const hit = ((data ?? []) as any[]).find((a) => !a.organization && Math.abs(toMin(String(a.start_time)) - toMin(start)) <= 15);
  if (hit) return hit.id;
  const { createActivityFor } = await import("@/lib/practices-repo");
  return createActivityFor({ date, start, end, location, group });
}

/** Chaque soir : les présences des événements passés (7 derniers jours) lues dans MonClubSportif deviennent les
 *  présences du site (fiche de la joueuse, bulletin, rapports), et la présence de chaque entraîneur confirme son
 *  assignation pour la paie (« MonClubSportif »). Rien n'est écrasé quand la famille n'a pas répondu. */
export async function syncMcsAttendance(opts: { days?: number; now?: number } = {}): Promise<{ players: number; coaches: number; unmatched: string[]; skipped?: string }> {
  const rules = await getMcsRules();
  if (!rules.robotActive) return { players: 0, coaches: 0, unmatched: [], skipped: "Robot pas encore activé (mode assistant)." };
  const session = await openRobotSession();
  if (!session) return { players: 0, coaches: 0, unmatched: [], skipped: "Compte robot pas encore enregistré." };
  const now = opts.now ?? Date.now();
  const since = now - (opts.days ?? 7) * 86_400_000;
  const teams = (await loadTeamTargets()).filter((t) => t.mcs_team_id && t.mcs_season_id);
  const players = await loadExpectedPlayers(teams);
  const [{ data: coaches }, { data: events }] = await Promise.all([
    db().from("coaches").select("id, first_name, last_name").eq("status", "active"),
    db().from("mcs_events").select("team_id, key, event_date, location, type").gte("event_date", dayIso(since)).lte("event_date", dayIso(now))
  ]);
  const byId = new Map<number, any>();
  for (const e of (events ?? []) as any[]) {
    const id = mcsIdOf(e.key)?.id;
    const [, s, en] = String(e.key).split("|");
    if (id) byId.set(id, { ...e, start: Number(s), end: Number(en) || null });
  }
  const { setPlayerAttendance } = await import("@/lib/coach-portal-repo");
  let nPlayers = 0;
  let nCoaches = 0;
  const unmatched = new Set<string>();
  for (const t of teams) {
    let grid: PresenceGrid;
    try {
      grid = await session.presences(t.mcs_team_id!, t.mcs_season_id!, 2);
    } catch {
      continue;
    }
    for (const ev of grid.events) {
      const e = byId.get(ev.id);
      if (!e || !e.start || e.start > now || e.start < since || e.type === "Match" || e.type === "Tournoi") continue;
      const date = String(e.event_date).slice(0, 10);
      const activityId = await activityFor(date, hm(e.start), e.end ? hm(e.end) : null, e.location ?? "", t.name);
      for (const row of grid.rows) {
        const status = attendanceFromMcs(row.states[ev.id]);
        if (!status) continue;
        const coach = ((coaches ?? []) as any[]).find((c) => sameMemberName(row.name, c.first_name, c.last_name));
        if (coach) {
          const { data: asg } = await db().from("coach_assignments").select("id, confirmed").eq("activity_id", activityId).eq("coach_id", coach.id).maybeSingle();
          const patch: Record<string, unknown> = { status: status === "absent" ? "absent" : "present", updated_at: new Date().toISOString() };
          if (status !== "absent" && !asg?.confirmed) Object.assign(patch, { confirmed: true, confirmed_at: new Date().toISOString(), confirmed_by: "MonClubSportif" });
          if (asg) await db().from("coach_assignments").update(patch).eq("id", asg.id);
          else if (status !== "absent") await db().from("coach_assignments").insert({ activity_id: activityId, coach_id: coach.id, arrival_time: hm(e.start), departure_time: e.end ? hm(e.end) : null, ...patch });
          nCoaches++;
          continue;
        }
        const p = players.find((x) => sameMemberName(row.name, x.firstName, x.lastName));
        if (!p?.registrationId) {
          unmatched.add(row.name);
          continue;
        }
        await setPlayerAttendance(activityId, p.registrationId, status);
        nPlayers++;
      }
    }
  }
  if (nPlayers || nCoaches) await logAudit({ actorRole: "admin", actorLabel: "Robot MonClubSportif", action: "mcs_attendance_sync", entityType: "activity_player_attendance", entityId: CLUB_ID, entityLabel: `${nPlayers} présences de jeunes, ${nCoaches} d'entraîneurs`, after: { unmatched: [...unmatched] } }).catch(() => null);
  return { players: nPlayers, coaches: nCoaches, unmatched: [...unmatched] };
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
      .map((e) => ({ id: mcsIdOf(e.key)?.id ?? 0, kind: mcsIdOf(e.key)?.type, date: String(e.event_date).slice(0, 10), start: String(e.start_time ?? "").slice(0, 5), end: e.end_time ? String(e.end_time).slice(0, 5) : null, title: e.title as string, isPractice: e.type !== "Match" && e.type !== "Tournoi" && !/st-?gabriel|elevate|finition|solo/i.test(e.title) }))
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
    for (const e of diff.extra) extras.push(`${t.name} : ${fmt(e.date)} ${e.start} « ${e.title.replace(/^(Event|Événement)\s+/i, "")} » n'est pas dans l'horaire du site`);
  }
  return { done, extras };
}

import { logAudit } from "@/lib/audit-repo";
import { CLUB, CLUB_ID } from "@/lib/club";
import { env } from "@/lib/env";
import { McsRobotError, McsSession, type PresenceGrid } from "@/lib/mcs-robot";
import { getRobotCredentials } from "@/lib/mcs-robot-config";
import { dueReminder, personKey, sameMemberName, teamsFor, yearsOf, type McsRules, type TeamTarget } from "@/lib/mcs-rules";
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
  const add = (p: Omit<ExpectedPlayer, "key" | "photoUrl" | "teams">, targets: TeamTarget[]) => {
    const key = personKey(p.firstName, p.lastName);
    if (!key || !targets.length) return;
    const prev = out.get(key);
    if (prev) {
      for (const t of targets) if (!prev.teams.some((x) => x.id === t.id)) prev.teams.push(t);
      return;
    }
    out.set(key, { ...p, key, photoUrl: photo.get(key) ?? null, teams: [...targets] });
  };
  for (const r of (regs ?? []) as any[]) {
    if (season?.id && r.season_id !== season.id) continue;
    const years = yearsOf(catLabel.get(`${r.season_id}|${r.category_id}`) ?? r.category_id);
    add(
      { firstName: String(r.player_first_name).trim(), lastName: String(r.player_last_name).trim(), gender: "female", birthYear: r.player_dob ? Number(String(r.player_dob).slice(0, 4)) : years.length === 1 ? years[0] : null, parentEmail: r.parent_email?.trim() || null, parentName: r.parent_name ?? null },
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
  const report: RobotReport = { ok: true, dryRun: dry, added: [], photos: [], opponents: [], unlocked: [], errors: [] };
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

  // 3 : le nom de l'adversaire sur chaque match payé.
  if (rules.opponentOnPaid) {
    try {
      report.opponents.push(...(await syncOpponents(session, teams, dry)));
    } catch (e) {
      report.errors.push(`Adversaires : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }

  report.ok = report.errors.length === 0;
  if (!dry && (report.added.length || report.photos.length || report.opponents.length || report.unlocked.length || report.errors.length)) {
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

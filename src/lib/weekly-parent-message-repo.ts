import { CLUB_ID } from "@/lib/club";
import { env } from "@/lib/env";
import { photoAllowed, shortName } from "@/lib/player-points";
import { getResendClient } from "@/lib/resend";
import { getThemeForDate, themeFor, type SeasonTheme } from "@/lib/season-themes-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { gameOfWeek, labLink, listAccess, listRoutines, monthOf, pickRoutine } from "@/lib/valkyria-lab";
import {
  buildWeeklyMessage,
  groupFamilies,
  isDue,
  localParts,
  longDay,
  parseSettings,
  pickChampionPhoto,
  serializeSettings,
  SETTINGS_KEY,
  targetWeek,
  type ChampionPhoto,
  type Family,
  type WeeklyMessage,
  type WeeklySettings
} from "@/lib/weekly-parent-message";

/** Message de la semaine aux parents (P4.5.01, P1.7.06) : lit les familles, les thèmes, les championnes et le Lab,
 *  construit un courriel par famille et l'envoie (mode réel seulement si le réglage est actif). Règles :
 *  weekly-parent-message.ts. À brancher dans un cron horaire : `runWeeklyParentMessage({ dryRun: false })`
 *  (ne part que le bon jour, à l'heure réglée, une fois par semaine). */

function db() {
  return getSupabaseAdminClient() as any;
}

const CHAMPIONS_BUCKET = "champions";
/** Le lien de la photo reste valide 8 jours (le courriel peut être ouvert plus tard dans la semaine). */
const PHOTO_LINK_SECONDS = 8 * 86_400;
const CHRISTINE = "Christinedurand.2@hotmail.com";

/* ── Réglage ── */

export async function getWeeklySettings(): Promise<WeeklySettings> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", SETTINGS_KEY).maybeSingle();
  return parseSettings(data?.value ?? null);
}

async function saveSettings(s: WeeklySettings): Promise<void> {
  const { error } = await db()
    .from("app_settings")
    .upsert({ club_id: CLUB_ID, key: SETTINGS_KEY, value: serializeSettings(s), updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
  if (error) throw new Error(error.message);
}

/** Interrupteur Actif / Inactif de l'admin. */
export async function setWeeklyActive(actif: boolean): Promise<WeeklySettings> {
  const next = { ...(await getWeeklySettings()), actif };
  await saveSettings(next);
  return next;
}

/* ── Données ── */

async function activeFamilies(today: string): Promise<Family[]> {
  const { data: seasons } = await db().from("seasons").select("id").eq("is_active", true);
  const ids: string[] = ((seasons ?? []) as any[]).map((s) => String(s.id)).filter((id) => id !== "demo");
  if (!ids.length) return [];
  const { data, error } = await db()
    .from("registrations")
    .select("id, parent_email, parent_name, player_first_name, player_last_name, category_id, season_id, status, is_trial, is_half_season, half_season_ends_on")
    .in("season_id", ids)
    .eq("status", "paid")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return groupFamilies((data ?? []) as any[], today);
}

/** Les photos de championnes publiées dans les 7 derniers jours, avec qui était attendu à chaque pratique. */
async function recentChampionPhotos(now: Date): Promise<ChampionPhoto[]> {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data, error } = await db()
    .from("champion_posts")
    .select(
      "id, activity_id, created_at, photo_path, activity:coach_activities(activity_date, title, category), lines:player_points(registration_id, registration:registrations(player_first_name, player_last_name, players(image_consent)))"
    )
    .eq("club_id", CLUB_ID)
    .eq("hidden", false)
    .not("photo_path", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  if (!rows.length) return [];
  const activityIds = [...new Set(rows.map((r) => r.activity_id).filter(Boolean))];
  const [{ data: att }, { data: signed }] = await Promise.all([
    db().from("activity_player_attendance").select("activity_id, registration_id").in("activity_id", activityIds),
    db().storage.from(CHAMPIONS_BUCKET).createSignedUrls(rows.map((r) => r.photo_path), PHOTO_LINK_SECONDS)
  ]);
  const expected = new Map<string, string[]>();
  for (const a of (att ?? []) as any[]) if (a.registration_id) expected.set(a.activity_id, [...(expected.get(a.activity_id) ?? []), a.registration_id]);
  const urls = new Map<string, string>();
  for (const s of (signed ?? []) as any[]) if (s.signedUrl && s.path) urls.set(s.path, s.signedUrl);
  return rows
    .map((r) => {
      const lines = (r.lines ?? []) as any[];
      return {
        postId: r.id,
        createdAt: r.created_at,
        photoUrl: urls.get(r.photo_path) ?? "",
        activityDate: String(r.activity?.activity_date ?? r.created_at).slice(0, 10),
        activityTitle: r.activity?.title || (r.activity?.category ? `Pratique ${r.activity.category}` : "Pratique"),
        names: lines.map((l) => shortName(String(l.registration?.player_first_name ?? ""), String(l.registration?.player_last_name ?? ""))).filter(Boolean),
        championIds: lines.map((l) => l.registration_id),
        expectedIds: expected.get(r.activity_id) ?? [],
        consent: photoAllowed(lines.map((l) => l.registration?.players?.image_consent))
      };
    })
    .filter((p) => p.photoUrl);
}

/* ── Construction ── */

export interface WeeklyBuild {
  weekStart: string;
  families: number;
  messages: (WeeklyMessage & { parentName: string | null; kids: string[] })[];
  /** Familles sans courriel cette semaine (ni thème, ni défi). */
  skipped: number;
}

/** Tous les courriels de la semaine, sans rien envoyer. */
export async function buildWeeklyMessages(now = new Date()): Promise<WeeklyBuild> {
  const today = localParts(now).date;
  const weekStart = targetWeek(today);
  const weekDate = new Date(`${weekStart}T12:00:00Z`);
  const [families, photos, routines, access] = await Promise.all([activeFamilies(today), recentChampionPhotos(now), listRoutines(), listAccess()]);

  const seasonIds = [...new Set(families.flatMap((f) => f.girls.map((g) => g.seasonId)).filter((x): x is string => Boolean(x)))];
  const themes = new Map<string, SeasonTheme | null>();
  await Promise.all(seasonIds.map(async (id) => themes.set(id, await getThemeForDate(id, weekDate).catch(() => null))));

  const picked = pickRoutine(routines, monthOf(weekStart));
  const routine = picked?.routine ?? null;
  const game = routine ? gameOfWeek(routine.weekly_games, weekStart)?.game ?? null : null;
  const labByEmail = new Map(access.filter((a) => a.active).map((a) => [a.parent_email.toLowerCase(), a.token]));
  const site = env.publicSiteUrl;

  const messages: WeeklyBuild["messages"] = [];
  for (const family of families) {
    const token = labByEmail.get(family.email);
    const msg = buildWeeklyMessage({
      family,
      weekStart,
      themes: family.girls.map((g) => ({ registrationId: g.registrationId, theme: themeFor(g.seasonId ? themes.get(g.seasonId) : null, g.category) })),
      photo: pickChampionPhoto(photos, family.girls.map((g) => g.registrationId)),
      home: routine ? { challenge: routine.challenge, game: game ? { title: game.title, how: game.how } : null, url: token ? labLink(token) : `${site}/compte/lab` } : null,
      siteUrl: site
    });
    if (msg) messages.push({ ...msg, parentName: family.parentName, kids: family.girls.map((g) => g.firstName) });
  }
  return { weekStart, families: families.length, messages, skipped: families.length - messages.length };
}

/* ── Envoi ── */

export interface WeeklyRunResult {
  dryRun: boolean;
  /** Pourquoi rien n'est parti (réglage inactif, pas le bon moment, déjà envoyé). */
  reason: string | null;
  weekStart: string;
  families: number;
  toSend: number;
  skipped: number;
  withPhoto: number;
  withChallenge: number;
  sent: number;
  failed: number;
}

/** Le message de la semaine. `dryRun` (par défaut) : construit et compte, n'envoie rien. Sinon : seulement si le
 *  réglage est actif, le bon jour à l'heure réglée et pas encore envoyé cette semaine (`force` saute le jour et
 *  l'heure, jamais l'interrupteur ni le « une fois par semaine »). Un courriel par famille, une seule adresse dans
 *  `to` ; Christine reçoit sa propre copie (un exemple et le nombre de familles). */
export async function runWeeklyParentMessage(opts: { dryRun?: boolean; force?: boolean; now?: Date } = {}): Promise<WeeklyRunResult> {
  const dryRun = opts.dryRun !== false;
  const now = opts.now ?? new Date();
  const settings = await getWeeklySettings();
  const weekStart = targetWeek(localParts(now).date);
  const empty = { dryRun, weekStart, families: 0, toSend: 0, skipped: 0, withPhoto: 0, withChallenge: 0, sent: 0, failed: 0 };

  if (!dryRun) {
    if (!settings.actif) return { ...empty, reason: "Réglage inactif (mode assistant)." };
    if (settings.dernierEnvoi === weekStart) return { ...empty, reason: "Déjà envoyé cette semaine." };
    if (!opts.force && !isDue(settings, now)) return { ...empty, reason: `Pas encore le moment (${settings.jour}, ${settings.heure} h).` };
  }

  const build = await buildWeeklyMessages(now);
  const base = {
    dryRun,
    weekStart: build.weekStart,
    families: build.families,
    toSend: build.messages.length,
    skipped: build.skipped,
    withPhoto: build.messages.filter((m) => m.hasPhoto).length,
    withChallenge: build.messages.filter((m) => m.hasChallenge).length
  };
  if (dryRun) return { ...base, reason: null, sent: 0, failed: 0 };
  if (!build.messages.length) return { ...base, reason: "Aucun courriel à envoyer (ni thème, ni défi cette semaine).", sent: 0, failed: 0 };

  // Noté avant d'envoyer : une erreur au milieu ne renvoie jamais le message aux familles déjà servies.
  await saveSettings({ ...settings, dernierEnvoi: build.weekStart });
  const resend = getResendClient();
  let sent = 0;
  let failed = 0;
  for (const m of build.messages) {
    try {
      const { error } = await resend.emails.send({ from: env.resendFrom, to: m.to, subject: m.subject, html: m.html });
      if (error) throw new Error(error.message);
      sent++;
    } catch (err) {
      console.error("Message de la semaine : envoi échoué", m.to, err);
      failed++;
    }
  }
  const sample = build.messages.find((m) => m.hasPhoto) ?? build.messages[0];
  try {
    await resend.emails.send({
      from: env.resendFrom,
      to: CHRISTINE,
      subject: `Copie : message de la semaine aux parents (${sent} famille${sent > 1 ? "s" : ""})`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px"><p>Bonjour Christine,</p><p>Le message de la semaine du ${longDay(build.weekStart)} est parti à ${sent} famille${sent > 1 ? "s" : ""}${failed ? ` (${failed} envoi${failed > 1 ? "s" : ""} en échec)` : ""}. Voici celui reçu par la famille de ${sample.kids.join(" et ")} :</p><hr style="border:0;border-top:1px solid #e7e1f0;margin:18px 0">${sample.html}</div>`
    });
  } catch (err) {
    console.error("Message de la semaine : copie à Christine échouée", err);
  }
  return { ...base, reason: null, sent, failed };
}

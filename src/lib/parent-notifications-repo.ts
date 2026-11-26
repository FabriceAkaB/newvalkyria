import { evaluatedPractices, periodRange, type BulletinPeriod } from "@/lib/bulletin-report";
import { CLUB_ID } from "@/lib/club";
import { env } from "@/lib/env";
import {
  bulletinNews,
  buildDigests,
  championNews,
  isEnabled,
  NEWS_WINDOW_DAYS,
  addDays,
  noticeId,
  normEmail,
  recent,
  SETTING_KEY,
  videoNews,
  type Digest,
  type NewsItem
} from "@/lib/parent-notifications";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Avis aux parents : lit les nouvelles (vidéos de progression, bulletins remis, championnes du jour), trouve les
 *  adresses des parents de chaque fille, puis envoie un courriel résumé par adresse (un par jour au plus) et garde
 *  la trace dans `parent_notices`. Règles pures : parent-notifications.ts. À appeler une fois par jour vers 18 h. */

function db() {
  return getSupabaseAdminClient() as any;
}

const todayToronto = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const day = (v: unknown) => String(v ?? "").slice(0, 10);
const first = (v: unknown) => String(v ?? "").trim();

async function inChunks<T>(ids: string[], run: (part: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) out.push(...(await run(ids.slice(i, i + 200))));
  return out;
}

async function settingEnabled(): Promise<boolean> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", SETTING_KEY).maybeSingle();
  return isEnabled(data?.value ?? null);
}

/* ── Les nouvelles ─────────────────────────────────────────────────── */

async function collectNews(today: string): Promise<NewsItem[]> {
  const since = `${addDays(today, -NEWS_WINDOW_DAYS - 1)}T00:00:00Z`;
  const names = new Map<string, string>();
  const nameOf = async (ids: string[]) => {
    const missing = [...new Set(ids)].filter((id) => !names.has(id));
    const rows = await inChunks(missing, async (part) => ((await db().from("registrations").select("id, player_first_name").in("id", part)).data ?? []) as any[]);
    for (const r of rows) names.set(r.id, first(r.player_first_name));
  };

  // Vidéos de progression déposées.
  const { data: vids, error: vErr } = await db()
    .from("player_progress_videos")
    .select("id, registration_id, checkpoint, title, created_at")
    .eq("club_id", CLUB_ID)
    // Seulement les vidéos d'étape (début, mi-saison, fin) : la famille ne voit pas les capsules « Autre ».
    .not("checkpoint", "is", null)
    .gte("created_at", since);
  if (vErr) throw new Error(vErr.message);

  // Championnes du jour (une ligne de points par fille et par publication).
  const { data: lines, error: cErr } = await db()
    .from("player_points")
    .select("registration_id, post_id, points, created_at, post:champion_posts(kind, title, hidden, activity:coach_activities(activity_date))")
    .eq("club_id", CLUB_ID)
    .not("post_id", "is", null)
    .gte("created_at", since);
  if (cErr) throw new Error(cErr.message);

  await nameOf([...((vids ?? []) as any[]).map((v) => v.registration_id), ...((lines ?? []) as any[]).map((l) => l.registration_id)]);

  const items: NewsItem[] = [
    ...videoNews(
      ((vids ?? []) as any[]).map((v) => ({ id: v.id, registrationId: v.registration_id, firstName: names.get(v.registration_id) ?? "", checkpoint: v.checkpoint, title: v.title ?? null, createdAt: String(v.created_at) })),
      today
    ),
    ...championNews(
      ((lines ?? []) as any[]).map((l) => ({
        postId: l.post_id,
        registrationId: l.registration_id,
        firstName: names.get(l.registration_id) ?? "",
        kind: l.post?.kind ?? "individuel",
        title: l.post?.title ?? null,
        points: Number(l.points ?? 0),
        activityDate: day(l.post?.activity?.activity_date),
        hidden: Boolean(l.post?.hidden),
        createdAt: String(l.created_at)
      })),
      today
    )
  ];

  // Bulletins remis : seulement dans les jours qui suivent la date de remise (mi-saison, fin de saison).
  const { data: season } = await db().from("seasons").select("id").eq("is_active", true).maybeSingle();
  const due = (["mi-saison", "fin-saison"] as BulletinPeriod[]).some((p) => {
    const r = periodRange(season?.id ?? null, p, today);
    return !r.provisional && recent(r.to, today);
  });
  if (season && due) {
    const { data: regs, error } = await db()
      .from("registrations")
      .select("id, player_first_name, season_id")
      .eq("season_id", season.id)
      .eq("status", "paid")
      .eq("is_trial", false);
    if (error) throw new Error(error.message);
    const ids = ((regs ?? []) as any[]).map((r) => r.id);
    const active = new Set(
      (await inChunks(ids, async (part) => ((await db().from("activity_player_attendance").select("registration_id").in("registration_id", part)).data ?? []) as any[])).map((a) => a.registration_id)
    );
    // Pratiques évaluées par fille et par bulletin : un bulletin sans ses 4 pratiques évaluées n'est pas remis.
    const evals = await inChunks(ids, async (part) => ((await db().from("player_evaluations").select("registration_id, activity_id, coach_id, ratings, activity:coach_activities(activity_date)").in("registration_id", part)).data ?? []) as any[]);
    const evaluated = (r: any) => {
      const list = evals.filter((e) => e.registration_id === r.id).map((e) => ({ date: String(e.activity?.activity_date ?? "").slice(0, 10), activityId: e.activity_id, coachId: e.coach_id, ratings: e.ratings ?? {} }));
      const of = (p: BulletinPeriod) => {
        const range = periodRange(r.season_id ?? null, p, today);
        return evaluatedPractices(list, range.from, range.to);
      };
      return { "mi-saison": of("mi-saison"), "fin-saison": of("fin-saison") };
    };
    items.push(...bulletinNews(((regs ?? []) as any[]).map((r) => ({ registrationId: r.id, firstName: first(r.player_first_name), seasonId: r.season_id ?? null, hasActivity: active.has(r.id), evaluated: evaluated(r) })), today));
  }
  return items.filter((i) => i.firstName);
}

/* ── Les adresses des parents ──────────────────────────────────────── */

/** Pour chaque inscription : le courriel de toutes les inscriptions payées de la même joueuse (l'autre parent a pu
 *  l'inscrire), et le courriel confirmé des comptes famille reliés (profil d'enfant relié à la joueuse, ou compte
 *  qui a fait l'inscription). Un compte au courriel non confirmé ne reçoit rien. */
async function collectRecipients(registrationIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, Set<string>>();
  if (!registrationIds.length) return new Map();
  const regs = await inChunks(registrationIds, async (part) => ((await db().from("registrations").select("id, player_id, parent_email, parent_user_id").in("id", part)).data ?? []) as any[]);
  const playerIds = [...new Set(regs.map((r) => r.player_id).filter(Boolean))] as string[];

  const [siblings, children] = await Promise.all([
    inChunks(playerIds, async (part) => ((await db().from("registrations").select("player_id, parent_email, parent_user_id").in("player_id", part).eq("status", "paid")).data ?? []) as any[]),
    inChunks(playerIds, async (part) => ((await db().from("children").select("player_id, parent_user_id").in("player_id", part)).data ?? []) as any[])
  ]);
  const userIds = [...new Set([...regs, ...siblings, ...children].map((r) => r.parent_user_id).filter(Boolean))] as string[];
  const checks = await inChunks(userIds, async (part) => ((await db().from("parent_email_checks").select("user_id, email").in("user_id", part).not("verified_at", "is", null)).data ?? []) as any[]);
  const verified = new Map<string, Set<string>>();
  for (const c of checks) {
    const set = verified.get(c.user_id) ?? new Set<string>();
    set.add(normEmail(c.email));
    verified.set(c.user_id, set);
  }

  for (const r of regs) {
    const set = out.get(r.id) ?? new Set<string>();
    const add = (email: unknown) => typeof email === "string" && email.trim() && set.add(normEmail(email));
    const addUser = (userId: unknown) => typeof userId === "string" && verified.get(userId)?.forEach((e) => set.add(e));
    add(r.parent_email);
    addUser(r.parent_user_id);
    if (r.player_id) {
      for (const s of siblings) if (s.player_id === r.player_id) (add(s.parent_email), addUser(s.parent_user_id));
      for (const c of children) if (c.player_id === r.player_id) addUser(c.parent_user_id);
    }
    out.set(r.id, set);
  }
  return new Map([...out].map(([k, v]) => [k, [...v]]));
}

/* ── Calcul et envoi ───────────────────────────────────────────────── */

export interface ParentNotificationsResult {
  enabled: boolean;
  dryRun: boolean;
  today: string;
  /** Nouvelles trouvées (avant de retirer celles déjà annoncées). */
  news: number;
  /** Courriels résumés à envoyer (dryRun) ou envoyés. */
  digests: { email: string; firstNames: string[]; subject: string; url: string; kinds: string[]; items: number }[];
  sent: number;
  errors: string[];
}

/** Calcule les résumés à envoyer et les envoie (en `dryRun`, n'envoie rien, n'écrit rien et rend la liste). */
export async function runParentNotifications(opts: { dryRun?: boolean; today?: string } = {}): Promise<ParentNotificationsResult> {
  const dryRun = Boolean(opts.dryRun);
  const today = opts.today ?? todayToronto();
  const result: ParentNotificationsResult = { enabled: true, dryRun, today, news: 0, digests: [], sent: 0, errors: [] };
  if (!(await settingEnabled())) return { ...result, enabled: false };

  const items = await collectNews(today);
  result.news = items.length;
  if (!items.length) return result;

  const recipients = await collectRecipients([...new Set(items.map((i) => i.registrationId))]);
  const emails = [...new Set([...recipients.values()].flat())];
  const keys = [...new Set(items.map((i) => i.key))];
  const [prior, todays] = await Promise.all([
    inChunks(keys, async (part) => ((await db().from("parent_notices").select("item_key, email").eq("club_id", CLUB_ID).in("item_key", part)).data ?? []) as any[]),
    inChunks(emails, async (part) => ((await db().from("parent_notices").select("email").eq("club_id", CLUB_ID).eq("sent_on", today).in("email", part)).data ?? []) as any[])
  ]);
  const digests: Digest[] = buildDigests({
    items,
    recipients,
    alreadySent: new Set(prior.map((p) => noticeId(p.item_key, p.email))),
    sentToday: new Set(todays.map((t) => normEmail(t.email))),
    siteUrl: env.publicSiteUrl
  });
  result.digests = digests.map((d) => ({ email: d.email, firstNames: d.firstNames, subject: d.subject, url: d.url, kinds: [...new Set(d.items.map((i) => i.kind))], items: d.items.length }));
  if (dryRun || !digests.length) return result;

  const { getResendClient } = await import("@/lib/resend");
  for (const d of digests) {
    try {
      const { error } = await getResendClient().emails.send({ from: env.resendFrom, to: d.email, subject: d.subject, html: d.html, text: d.text } as never);
      if (error) throw new Error(error.message);
      const { error: logErr } = await db()
        .from("parent_notices")
        .upsert(
          d.items.map((i) => ({ club_id: CLUB_ID, item_key: i.key, kind: i.kind, registration_id: i.registrationId, email: d.email, sent_on: today })),
          { onConflict: "club_id,item_key,email", ignoreDuplicates: true }
        );
      if (logErr) result.errors.push(`Trace non écrite pour un courriel : ${logErr.message}`);
      result.sent++;
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : "Envoi impossible");
    }
  }
  return result;
}

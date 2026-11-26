import { sortTitles, type ChampionTitle } from "@/lib/champion-titles";
import { CLUB_ID } from "@/lib/club";
import { PARTICIPATED } from "@/lib/coach-report";
import {
  canRedeem,
  championPoints,
  checkChampions,
  expiryStatus,
  lineKindOf,
  normalizeRules,
  photoAllowed,
  pointsBalance,
  REWARD_KINDS,
  shortName,
  type ChampionKind,
  type PointsRules,
  type RewardKind
} from "@/lib/player-points";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncRefTask } from "@/lib/team-tasks-repo";

/** Points des joueuses : barème, championnes du jour (publiées par l'éducateur, photo en stockage privé), soldes,
 *  récompenses demandées par les familles (une tâche pour l'équipe à chaque demande) et fin de saison.
 *  Règles pures : player-points.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

const BUCKET = "champions";
const RULES_KEY = "points_bareme";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/* ── Barème ────────────────────────────────────────────────────────── */

export async function getRules(): Promise<PointsRules> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", RULES_KEY).maybeSingle();
  return normalizeRules(data?.value ?? null);
}

export async function saveRules(input: Partial<PointsRules>): Promise<PointsRules> {
  const rules = normalizeRules({ ...(await getRules()), ...input });
  const { error } = await db()
    .from("app_settings")
    .upsert({ club_id: CLUB_ID, key: RULES_KEY, value: JSON.stringify(rules), updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
  if (error) throw new Error(error.message);
  return rules;
}

/* ── Inscriptions : bienvenue et fin de saison ─────────────────────── */

interface RegMeta {
  id: string;
  playerId: string | null;
  firstName: string;
  lastName: string;
  seasonId: string | null;
  /** Dernière journée de la saison (seasons.ends_on) ; sans date, pas de bienvenue ni d'expiration. */
  seasonEnd: string | null;
  welcome: boolean;
}

async function regMeta(ids: string[]): Promise<Map<string, RegMeta>> {
  const out = new Map<string, RegMeta>();
  if (!ids.length) return out;
  const [{ data: regs, error }, { data: seasons }] = await Promise.all([
    db().from("registrations").select("id, player_id, player_first_name, player_last_name, season_id, status, is_trial").in("id", ids),
    db().from("seasons").select("id, ends_on")
  ]);
  if (error) throw new Error(error.message);
  const endOf = new Map(((seasons ?? []) as any[]).map((s) => [s.id, s.ends_on ? String(s.ends_on).slice(0, 10) : null]));
  for (const r of (regs ?? []) as any[]) {
    const seasonEnd = endOf.get(r.season_id) ?? null;
    out.set(r.id, {
      id: r.id,
      playerId: r.player_id ?? null,
      firstName: String(r.player_first_name ?? "").trim(),
      lastName: String(r.player_last_name ?? "").trim(),
      seasonId: r.season_id ?? null,
      seasonEnd,
      welcome: r.status === "paid" && !r.is_trial && Boolean(seasonEnd)
    });
  }
  return out;
}

/* ── Soldes ────────────────────────────────────────────────────────── */

export interface PointsSummary {
  registrationId: string;
  presences: number;
  presence: number;
  bienvenue: number;
  victoires: number;
  attitudes: number;
  /** Points gagnés depuis le début de la saison (niveau). */
  earned: number;
  spent: number;
  expired: number;
  /** Ce qui reste à dépenser. */
  balance: number;
  seasonEnd: string | null;
  phase: "loin" | "bientot" | "dernier" | "expire" | null;
  daysLeft: number | null;
}

/** Soldes de points : bienvenue et présences recalculées à chaque lecture (une présence saisie en retard compte tout
 *  de suite), championnes et dépenses lues dans player_points. */
export async function getPointsSummaries(registrationIds: string[], rules?: PointsRules): Promise<Map<string, PointsSummary>> {
  const out = new Map<string, PointsSummary>();
  const ids = [...new Set(registrationIds)];
  if (!ids.length) return out;
  const [bareme, meta, { data: att, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    rules ? Promise.resolve(rules) : getRules(),
    regMeta(ids),
    db().from("activity_player_attendance").select("registration_id, status").in("registration_id", ids),
    db().from("player_points").select("registration_id, kind, points, status").in("registration_id", ids)
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2).message);
  const now = today();
  for (const id of ids) {
    const m = meta.get(id);
    const presences = ((att ?? []) as any[]).filter((a) => a.registration_id === id && PARTICIPATED.includes(a.status)).length;
    const mine = ((lines ?? []) as any[]).filter((l) => l.registration_id === id);
    const exp = m?.seasonEnd ? expiryStatus(m.seasonEnd, now) : null;
    out.set(id, {
      registrationId: id,
      presences,
      ...pointsBalance(presences, mine, bareme, m?.welcome ?? false),
      seasonEnd: m?.seasonEnd ?? null,
      phase: exp?.phase ?? null,
      daysLeft: exp?.daysLeft ?? null
    });
  }
  return out;
}

export interface PointsHistoryLine {
  id: string;
  date: string;
  kind: string;
  points: number;
  label: string;
  status: string | null;
}

/** L'historique d'une joueuse : championnes, bonus, dépenses et expiration (les présences sont comptées à part). */
export async function getPointsHistory(registrationId: string): Promise<PointsHistoryLine[]> {
  const { data, error } = await db()
    .from("player_points")
    .select("id, kind, points, note, status, created_at, post:champion_posts(kind, title), activity:coach_activities(activity_date, title, category)")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((l) => {
    const date = l.activity?.activity_date ? String(l.activity.activity_date).slice(0, 10) : new Date(l.created_at).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    const what =
      l.kind === "echange"
        ? `Récompense : ${l.note ?? "récompense"}`
        : l.kind === "expiration"
          ? `Fin de saison : ${l.note ?? "cadeau de fin de saison"}`
          : l.kind === "bonus"
            ? l.note || "Bonus"
            : l.post?.title || (l.kind === "attitude" ? "Attitude" : l.post?.kind === "groupe" ? "Groupe gagnant" : l.post?.kind === "special" ? "Partie spéciale" : "Gagnante");
    return { id: l.id, date, kind: l.kind, points: l.points, label: what, status: l.status ?? null };
  });
}

/* ── Championnes du jour ───────────────────────────────────────────── */

export interface ChampionPost {
  id: string;
  activityId: string;
  kind: ChampionKind;
  title: string | null;
  points: number;
  createdAt: string;
  coachName: string | null;
  hidden: boolean;
  activity: { date: string; title: string };
  girls: { registrationId: string; name: string; mine?: boolean }[];
  /** Lien signé (1 h) vers la photo, seulement si toutes les filles ont toujours l'autorisation photo. */
  photoUrl: string | null;
}

const POST_COLS =
  "id, activity_id, kind, title, points, photo_path, hidden, created_at, coach:coaches(first_name, last_name), activity:coach_activities(activity_date, title, category), lines:player_points(registration_id, registration:registrations(player_first_name, player_last_name, player_id, players(image_consent)))";

async function toPosts(rows: any[], mine: Set<string> = new Set(), fullNames = false): Promise<ChampionPost[]> {
  const withPhoto = rows.filter((r) => r.photo_path && photoAllowed(((r.lines ?? []) as any[]).map((l) => l.registration?.players?.image_consent)));
  const signed = new Map<string, string>();
  if (withPhoto.length) {
    const { data } = await db().storage.from(BUCKET).createSignedUrls(withPhoto.map((r) => r.photo_path), 3600);
    for (const s of (data ?? []) as any[]) if (s.signedUrl && s.path) signed.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    kind: r.kind,
    title: r.title ?? null,
    points: r.points,
    createdAt: r.created_at,
    hidden: Boolean(r.hidden),
    coachName: r.coach ? `${r.coach.first_name ?? ""} ${String(r.coach.last_name ?? "").charAt(0)}.`.trim() : null,
    activity: { date: String(r.activity?.activity_date ?? r.created_at).slice(0, 10), title: r.activity?.title || r.activity?.category || "Pratique" },
    girls: ((r.lines ?? []) as any[])
      .map((l) => {
        const first = String(l.registration?.player_first_name ?? "");
        const last = String(l.registration?.player_last_name ?? "");
        return { registrationId: l.registration_id, name: fullNames ? `${first} ${last}`.trim() : shortName(first, last), mine: mine.has(l.registration_id) || undefined };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    photoUrl: withPhoto.includes(r) ? signed.get(r.photo_path) ?? null : null
  }));
}

/** Les championnes d'une pratique, pour l'éducateur (noms complets). */
export async function getActivityChampions(activityId: string): Promise<ChampionPost[]> {
  const { data, error } = await db().from("champion_posts").select(POST_COLS).eq("activity_id", activityId).order("created_at");
  if (error) throw new Error(error.message);
  return toPosts((data ?? []) as any[], new Set(), true);
}

/** Championnes récentes (admin), y compris celles retirées du fil. */
export async function getRecentChampions(days = 14): Promise<ChampionPost[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db().from("champion_posts").select(POST_COLS).eq("club_id", CLUB_ID).gte("created_at", since).order("created_at", { ascending: false }).limit(60);
  if (error) throw new Error(error.message);
  return toPosts((data ?? []) as any[], new Set(), true);
}

/** Le fil des familles : les championnes des pratiques où leur fille était attendue (rien des autres groupes),
 *  prénom et initiale seulement, photo seulement avec l'autorisation de chaque famille. */
export async function getFamilyFeed(registrationIds: string[], limit = 40): Promise<ChampionPost[]> {
  if (!registrationIds.length) return [];
  const { data: att } = await db().from("activity_player_attendance").select("activity_id").in("registration_id", registrationIds);
  const activityIds = [...new Set(((att ?? []) as any[]).map((a) => a.activity_id))];
  const { data: own } = await db().from("player_points").select("post_id").in("registration_id", registrationIds).not("post_id", "is", null);
  const ownPosts = ((own ?? []) as any[]).map((p) => p.post_id);
  if (!activityIds.length && !ownPosts.length) return [];
  const filters = [activityIds.length ? `activity_id.in.(${activityIds.join(",")})` : null, ownPosts.length ? `id.in.(${ownPosts.join(",")})` : null].filter(Boolean).join(",");
  const { data, error } = await db().from("champion_posts").select(POST_COLS).eq("hidden", false).or(filters).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return toPosts((data ?? []) as any[], new Set(registrationIds));
}

/** Le palmarès de chaque fille de la famille (JP, 25 nov. 2026) : chaque fois qu'elle a été championne du jour, la
 *  plus récente en haut. Seulement ses propres titres (ses lignes de points liées à une publication) ; les autres
 *  filles du même titre en prénom et initiale ; photo seulement avec l'autorisation de chaque famille et jamais pour
 *  une publication retirée du fil par l'admin (le titre et ses points restent). */
export async function getChampionTitles(registrationIds: string[]): Promise<Map<string, ChampionTitle[]>> {
  const out = new Map<string, ChampionTitle[]>(registrationIds.map((id) => [id, []]));
  if (!registrationIds.length) return out;
  const { data: lines, error } = await db()
    .from("player_points")
    .select("id, registration_id, post_id, points, created_at")
    .in("registration_id", registrationIds)
    .not("post_id", "is", null)
    .limit(1000);
  if (error) throw new Error(error.message);
  const postIds = [...new Set(((lines ?? []) as any[]).map((l) => l.post_id))];
  if (!postIds.length) return out;
  const { data: rows, error: e2 } = await db().from("champion_posts").select(POST_COLS).in("id", postIds);
  if (e2) throw new Error(e2.message);
  const posts = new Map((await toPosts((rows ?? []) as any[])).map((p) => [p.id, p]));
  for (const l of (lines ?? []) as any[]) {
    const p = posts.get(l.post_id);
    if (!p) continue;
    out.get(l.registration_id)?.push({
      id: l.id,
      postId: p.id,
      registrationId: l.registration_id,
      date: p.activity.date,
      createdAt: p.createdAt,
      kind: p.kind,
      title: p.title,
      points: l.points,
      group: p.activity.title,
      coachName: p.coachName,
      teammates: p.girls.filter((g) => g.registrationId !== l.registration_id).map((g) => g.name),
      photoUrl: p.hidden ? null : p.photoUrl
    });
  }
  for (const [id, list] of out) out.set(id, sortTitles(list));
  return out;
}

export interface PublishInput {
  activityId: string;
  kind: ChampionKind;
  registrationIds: string[];
  title?: string | null;
  specialPoints?: number | null;
  coachId: string | null;
  photo?: { bytes: Uint8Array; contentType: string } | null;
}

/** Publie des championnes : points donnés à chacune selon le barème, photo en stockage privé si toutes les filles
 *  ont l'autorisation photo. Renvoie le problème à montrer, ou null. */
export async function publishChampions(input: PublishInput): Promise<{ error: string | null; postId?: string }> {
  const ids = [...new Set(input.registrationIds)];
  const [rules, meta, { data: prior }] = await Promise.all([
    getRules(),
    regMeta(ids),
    db().from("player_points").select("registration_id, points").eq("activity_id", input.activityId).not("post_id", "is", null)
  ]);
  const points = championPoints(input.kind, rules, input.specialPoints);
  const already = new Map<string, number>();
  for (const p of (prior ?? []) as any[]) already.set(p.registration_id, (already.get(p.registration_id) ?? 0) + p.points);
  const problem = checkChampions({ kind: input.kind, ids, points, rules, already, nameOf: (id) => meta.get(id)?.firstName || "Cette joueuse" });
  if (problem) return { error: problem };

  if (input.photo) {
    const playerIds = ids.map((id) => meta.get(id)?.playerId).filter((x): x is string => Boolean(x));
    const { data: players } = playerIds.length ? await db().from("players").select("id, image_consent").in("id", playerIds) : { data: [] };
    const consent = new Map(((players ?? []) as any[]).map((p) => [p.id, p.image_consent]));
    const missing = ids.filter((id) => !photoAllowed([consent.get(meta.get(id)?.playerId ?? "")]));
    if (missing.length) return { error: `Pas de photo : ${missing.map((id) => meta.get(id)?.firstName).join(", ")} n'a pas l'autorisation photo de sa famille. Publie sans photo.` };
  }

  const { data: post, error } = await db()
    .from("champion_posts")
    .insert({ club_id: CLUB_ID, activity_id: input.activityId, kind: input.kind, title: input.title?.trim().slice(0, 80) || null, points, coach_id: input.coachId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const kind = lineKindOf(input.kind);
  const { error: e2 } = await db()
    .from("player_points")
    .insert(ids.map((id) => ({ club_id: CLUB_ID, registration_id: id, player_id: meta.get(id)?.playerId ?? null, activity_id: input.activityId, post_id: post.id, kind, points, coach_id: input.coachId })));
  if (e2) {
    await db().from("champion_posts").delete().eq("id", post.id);
    throw new Error(e2.message);
  }
  if (input.photo) {
    const ext = input.photo.contentType === "image/png" ? "png" : input.photo.contentType === "image/webp" ? "webp" : "jpg";
    const path = `${input.activityId}/${post.id}.${ext}`;
    const { error: up } = await db().storage.from(BUCKET).upload(path, input.photo.bytes, { contentType: input.photo.contentType, upsert: true });
    if (up) return { error: `Championnes publiées, mais la photo n'est pas passée (${up.message}). Réessaie la photo plus tard.`, postId: post.id };
    await db().from("champion_posts").update({ photo_path: path }).eq("id", post.id);
  }
  return { error: null, postId: post.id };
}

/** Retire une publication (et ses points). */
export async function deleteChampionPost(postId: string, activityId?: string): Promise<void> {
  let q = db().from("champion_posts").select("id, photo_path").eq("id", postId);
  if (activityId) q = q.eq("activity_id", activityId);
  const { data } = await q.maybeSingle();
  if (!data) return;
  if (data.photo_path) await db().storage.from(BUCKET).remove([data.photo_path]);
  const { error } = await db().from("champion_posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);
}

/** Admin : retirer une publication du fil des familles sans enlever les points (ou la remettre). */
export async function setChampionPostHidden(postId: string, hidden: boolean): Promise<void> {
  const { error } = await db().from("champion_posts").update({ hidden }).eq("id", postId).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}

/* ── Récompenses ──────────────────────────────────────────────────── */

export interface PointReward {
  id: string;
  name: string;
  cost: number;
  kind: RewardKind;
  value_cents: number | null;
  description: string | null;
  is_default: boolean;
  product_id: string | null;
  active: boolean;
  /** Exemplaires à gagner (ex. 1 = prix unique) ; null = autant qu'on veut. */
  stock: number | null;
  /** Exemplaires qui restent (null = illimité). */
  left: number | null;
}

export async function getRewards(): Promise<PointReward[]> {
  const { data, error } = await db().from("point_rewards").select("id, name, cost, kind, value_cents, description, is_default, product_id, active, stock").eq("club_id", CLUB_ID).order("cost");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<PointReward, "left">[];
  const limited = rows.filter((r) => r.stock !== null && r.stock !== undefined).map((r) => r.id);
  const { data: taken } = limited.length ? await db().from("player_points").select("reward_id").in("reward_id", limited).neq("status", "annulee") : { data: [] };
  const used = new Map<string, number>();
  for (const t of (taken ?? []) as any[]) used.set(t.reward_id, (used.get(t.reward_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, stock: r.stock ?? null, left: r.stock === null || r.stock === undefined ? null : Math.max(0, r.stock - (used.get(r.id) ?? 0)) }));
}

export async function saveReward(input: {
  id?: string;
  name: string;
  cost: number;
  kind: RewardKind;
  valueCents: number | null;
  description: string | null;
  isDefault: boolean;
  productId: string | null;
  active: boolean;
  stock?: number | null;
}): Promise<void> {
  const row = {
    club_id: CLUB_ID,
    name: input.name.trim().slice(0, 120),
    cost: Math.max(1, Math.round(input.cost)),
    kind: input.kind,
    value_cents: input.kind === "cadeau" ? null : input.valueCents,
    description: input.description?.trim().slice(0, 300) || null,
    is_default: input.isDefault,
    product_id: input.productId,
    active: input.active,
    ...(input.stock !== undefined ? { stock: input.stock && input.stock > 0 ? Math.round(input.stock) : null } : {})
  };
  if (input.isDefault) await db().from("point_rewards").update({ is_default: false }).eq("club_id", CLUB_ID).neq("id", input.id ?? "00000000-0000-0000-0000-000000000000");
  const q = input.id ? db().from("point_rewards").update(row).eq("id", input.id).eq("club_id", CLUB_ID) : db().from("point_rewards").insert(row);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export interface Redemption {
  id: string;
  registrationId: string;
  playerName: string;
  reward: string;
  points: number;
  status: "demandee" | "remise" | "annulee";
  createdAt: string;
  deliveredAt: string | null;
}

const rewardTaskTitle = (reward: string, name: string) => `Remettre « ${reward} » à ${name} (points Valkyria)`;

/** Demande une récompense : les points sont retirés tout de suite (réservés) et une tâche est créée pour l'équipe.
 *  `deliverNow` : l'admin la remet sur-le-champ (pas de tâche). */
export async function requestReward(input: { registrationId: string; rewardId: string; by: "famille" | "admin"; deliverNow?: boolean }): Promise<string | null> {
  const reward = (await getRewards()).find((r) => r.id === input.rewardId && r.active);
  if (!reward) return "Cette récompense n'est plus offerte.";
  if (reward.left === 0) return reward.stock === 1 ? "Ce prix unique a déjà été gagné." : "Il n'en reste plus : tous les exemplaires ont été gagnés.";
  const [summary, meta] = await Promise.all([getPointsSummaries([input.registrationId]).then((m) => m.get(input.registrationId)), regMeta([input.registrationId]).then((m) => m.get(input.registrationId))]);
  if (!summary || !meta) return "Joueuse introuvable.";
  const problem = canRedeem({ balance: summary.balance, cost: reward.cost, expired: summary.phase === "expire" });
  if (problem) return problem;
  const value = reward.value_cents ? ` (${(reward.value_cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })})` : "";
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("player_points")
    .insert({
      club_id: CLUB_ID,
      registration_id: input.registrationId,
      player_id: meta.playerId,
      kind: "echange",
      points: -reward.cost,
      reward_id: reward.id,
      note: `${reward.name}${value}`,
      status: input.deliverNow ? "remise" : "demandee",
      delivered_at: input.deliverNow ? now : null
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!input.deliverNow) {
    const name = `${meta.firstName} ${meta.lastName}`.trim();
    await syncRefTask(`points:${data.id}`, {
      title: rewardTaskTitle(`${reward.name}${value}`, name),
      details: `${REWARD_KINDS[reward.kind].label} demandé par ${input.by === "famille" ? "la famille dans son espace" : "l'admin"} : ${reward.cost} points déjà retirés. ${REWARD_KINDS[reward.kind].how}. Marquer « Remise » dans Coaching → Points quand c'est fait.`,
      due: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
    });
  }
  return null;
}

/** Récompense remise (la tâche se coche) ou annulée (les points reviennent). */
export async function setRedemptionStatus(lineId: string, status: "remise" | "annulee"): Promise<void> {
  const { data } = await db().from("player_points").select("id, kind, note, registration_id").eq("id", lineId).eq("kind", "echange").maybeSingle();
  if (!data) throw new Error("Demande introuvable");
  const { error } = await db()
    .from("player_points")
    .update({ status, delivered_at: status === "remise" ? new Date().toISOString() : null })
    .eq("id", lineId);
  if (error) throw new Error(error.message);
  await syncRefTask(`points:${lineId}`, { title: "", done: true, doneNote: status === "remise" ? "Récompense remise" : "Demande annulée, points rendus" });
}

export async function getRedemptions(opts: { registrationIds?: string[]; openOnly?: boolean } = {}): Promise<Redemption[]> {
  let q = db()
    .from("player_points")
    .select("id, registration_id, note, points, status, created_at, delivered_at, registration:registrations(player_first_name, player_last_name)")
    .eq("club_id", CLUB_ID)
    .eq("kind", "echange")
    .order("created_at", { ascending: false })
    .limit(200);
  if (opts.registrationIds) q = q.in("registration_id", opts.registrationIds.length ? opts.registrationIds : ["00000000-0000-0000-0000-000000000000"]);
  if (opts.openOnly) q = q.eq("status", "demandee");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((l) => ({
    id: l.id,
    registrationId: l.registration_id,
    playerName: `${l.registration?.player_first_name ?? ""} ${l.registration?.player_last_name ?? ""}`.trim(),
    reward: l.note ?? "Récompense",
    points: Math.abs(l.points),
    status: (l.status ?? "remise") as Redemption["status"],
    createdAt: l.created_at,
    deliveredAt: l.delivered_at ?? null
  }));
}

/* ── Fin de saison ─────────────────────────────────────────────────── */

async function refTaskOnce(ref: string, input: { title: string; details?: string | null; due?: string | null }): Promise<boolean> {
  const { data } = await db().from("team_tasks").select("id").eq("club_id", CLUB_ID).eq("ref", ref).limit(1);
  if (data?.length) return false;
  await syncRefTask(ref, input);
  return true;
}

/** Chaque jour (cron « pratiques ») : 21 jours avant la fin d'une saison, une tâche pour rappeler aux familles de
 *  dépenser leurs points ; après la dernière journée, le solde de chaque joueuse devient le cadeau par défaut
 *  (ligne « expiration », une seule par inscription) et une tâche dit à qui le remettre. */
export async function runSeasonPointsEnd(now = today()): Promise<{ reminded: number; expired: number }> {
  const { data: seasons } = await db().from("seasons").select("id, label, ends_on").not("ends_on", "is", null);
  let reminded = 0;
  let expired = 0;
  for (const s of (seasons ?? []) as any[]) {
    const end = String(s.ends_on).slice(0, 10);
    const { daysLeft, phase } = expiryStatus(end, now);
    if (s.id === "demo") continue;
    if (phase !== "expire" && daysLeft <= 21) {
      const due = new Date(Date.parse(`${end}T12:00:00Z`) - 14 * 86_400_000).toISOString().slice(0, 10);
      if (await refTaskOnce(`points-rappel:${s.id}`, { title: `Rappeler aux familles de dépenser leurs points Valkyria avant le ${end}`, details: `${s.label} : les points restants deviennent le cadeau par défaut après le ${end}. Courriel aux familles (skill courriel-familles) avec le lien de l'espace famille, onglet Points.`, due })) reminded++;
    }
    if (phase !== "expire") continue;
    const { data: regs } = await db().from("registrations").select("id").eq("season_id", s.id).eq("status", "paid").eq("is_trial", false);
    const ids = ((regs ?? []) as any[]).map((r) => r.id);
    if (!ids.length) continue;
    const [summaries, meta, rewards, { data: done }] = await Promise.all([
      getPointsSummaries(ids),
      regMeta(ids),
      getRewards(),
      db().from("player_points").select("registration_id").eq("kind", "expiration").in("registration_id", ids)
    ]);
    const already = new Set(((done ?? []) as any[]).map((d) => d.registration_id));
    const gift = rewards.find((r) => r.is_default && r.active)?.name ?? "Cadeau de fin de saison";
    const rows = ids
      .filter((id) => !already.has(id) && (summaries.get(id)?.balance ?? 0) > 0)
      .map((id) => ({ club_id: CLUB_ID, registration_id: id, player_id: meta.get(id)?.playerId ?? null, kind: "expiration", points: -(summaries.get(id)!.balance), note: gift, status: "demandee" }));
    if (!rows.length) continue;
    const { error } = await db().from("player_points").insert(rows);
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    expired += rows.length;
    const names = rows.map((r) => `${meta.get(r.registration_id)?.firstName} ${meta.get(r.registration_id)?.lastName}`.trim()).sort((a, b) => a.localeCompare(b, "fr"));
    await syncRefTask(`points-fin:${s.id}`, {
      title: `Remettre le cadeau de fin de saison (${gift}) à ${names.length} joueuse${names.length > 1 ? "s" : ""}`,
      details: `${s.label} terminée le ${end} : leurs points restants sont devenus ce cadeau. ${names.join(", ")}.`,
      due: new Date(Date.parse(`${now}T12:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10)
    });
  }
  return { reminded, expired };
}

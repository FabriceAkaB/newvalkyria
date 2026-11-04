import { CLUB_ID } from "@/lib/club";
import { PARTICIPATED } from "@/lib/coach-report";
import { canAddWinner, MAX_WINNERS, POINTS, pointsBalance, type WinKind } from "@/lib/player-points";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Points des joueuses : gagnantes du jour (rapport de l'éducateur), soldes, récompenses et échanges. */

function db() {
  return getSupabaseAdminClient() as any;
}

export async function getActivityWinners(activityId: string): Promise<{ registration_id: string; kind: WinKind }[]> {
  const { data, error } = await db().from("player_points").select("registration_id, kind").eq("activity_id", activityId).in("kind", ["victoire", "attitude"]);
  if (error) throw new Error(error.message);
  return (data ?? []) as { registration_id: string; kind: WinKind }[];
}

/** Nomme (ou retire) une gagnante du jour. Refuse une 4e gagnante dans la même catégorie. */
export async function setWinner(input: { activityId: string; registrationId: string; kind: WinKind; on: boolean; coachId: string | null }): Promise<string | null> {
  if (!input.on) {
    const { error } = await db().from("player_points").delete().eq("activity_id", input.activityId).eq("registration_id", input.registrationId).eq("kind", input.kind);
    if (error) throw new Error(error.message);
    return null;
  }
  const winners = (await getActivityWinners(input.activityId)).filter((w) => w.kind === input.kind && w.registration_id !== input.registrationId);
  if (!canAddWinner(winners.length)) return `Déjà ${MAX_WINNERS} gagnantes dans cette catégorie pour cette pratique : retire-en une d'abord.`;
  const { data: reg } = await db().from("registrations").select("player_id").eq("id", input.registrationId).maybeSingle();
  const { error } = await db()
    .from("player_points")
    .upsert(
      { club_id: CLUB_ID, registration_id: input.registrationId, player_id: reg?.player_id ?? null, activity_id: input.activityId, kind: input.kind, points: POINTS[input.kind], coach_id: input.coachId },
      { onConflict: "activity_id,registration_id,kind", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
  return null;
}

export interface PointsSummary {
  registrationId: string;
  presences: number;
  victoires: number;
  attitudes: number;
  earned: number;
  spent: number;
  balance: number;
  /** Récompenses déjà remises (débloquées à un palier, une seule fois chacune). */
  givenRewardIds: string[];
}

/** Soldes de points (présences comptées automatiquement à partir des présences du rapport). */
export async function getPointsSummaries(registrationIds: string[]): Promise<Map<string, PointsSummary>> {
  const out = new Map<string, PointsSummary>();
  if (!registrationIds.length) return out;
  const [{ data: att, error: e1 }, { data: lines, error: e2 }] = await Promise.all([
    db().from("activity_player_attendance").select("registration_id, status").in("registration_id", registrationIds),
    db().from("player_points").select("registration_id, kind, points, reward_id").in("registration_id", registrationIds)
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2).message);
  for (const id of registrationIds) {
    const presences = ((att ?? []) as any[]).filter((a) => a.registration_id === id && PARTICIPATED.includes(a.status)).length;
    const mine = ((lines ?? []) as any[]).filter((l) => l.registration_id === id);
    out.set(id, { registrationId: id, presences, ...pointsBalance(presences, mine), givenRewardIds: mine.filter((l) => l.kind === "echange" && l.reward_id).map((l) => l.reward_id as string) });
  }
  return out;
}

/* ── Récompenses ──────────────────────────────────────────────────── */

export interface PointReward {
  id: string;
  name: string;
  cost: number;
  product_id: string | null;
  active: boolean;
}

export async function getRewards(): Promise<PointReward[]> {
  const { data, error } = await db().from("point_rewards").select("id, name, cost, product_id, active").eq("club_id", CLUB_ID).order("cost");
  if (error) throw new Error(error.message);
  return (data ?? []) as PointReward[];
}

export async function saveReward(input: { id?: string; name: string; cost: number; productId: string | null; active: boolean }): Promise<void> {
  const row = { club_id: CLUB_ID, name: input.name.trim().slice(0, 120), cost: Math.round(input.cost), product_id: input.productId, active: input.active };
  const q = input.id ? db().from("point_rewards").update(row).eq("id", input.id).eq("club_id", CLUB_ID) : db().from("point_rewards").insert(row);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

/** Remet une récompense débloquée : la joueuse a atteint son palier de points ; une seule fois par récompense.
 *  Les points ne baissent pas (progression comme dans un jeu). */
export async function redeemReward(registrationId: string, rewardId: string): Promise<string | null> {
  const reward = (await getRewards()).find((r) => r.id === rewardId && r.active);
  if (!reward) return "Récompense introuvable.";
  const summary = (await getPointsSummaries([registrationId])).get(registrationId);
  if (!summary || summary.earned < reward.cost) return `Pas encore débloquée : ${summary?.earned ?? 0} points sur ${reward.cost}.`;
  if (summary.givenRewardIds.includes(reward.id)) return "Déjà remise à cette joueuse.";
  const { data: reg } = await db().from("registrations").select("player_id").eq("id", registrationId).maybeSingle();
  const { error } = await db()
    .from("player_points")
    .insert({ club_id: CLUB_ID, registration_id: registrationId, player_id: reg?.player_id ?? null, kind: "echange", points: 0, reward_id: reward.id, note: reward.name });
  if (error) throw new Error(error.message);
  return null;
}

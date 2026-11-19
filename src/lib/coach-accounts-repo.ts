import { activityEndMs } from "@/lib/coach-report";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Comptes des éducateurs et lecture des pratiques (JP, 19 nov. 2026) : le compte est-il activé (mot de passe
 *  choisi), quand se sont-ils connectés, et ont-ils lu leurs pratiques AVANT qu'elles commencent ? */

function db() {
  return getSupabaseAdminClient() as any;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export interface CoachAccountStatus {
  coachId: string;
  /** Mot de passe choisi : le compte est activé. */
  activated: boolean;
  lastLogin: string | null;
  invitedAt: string | null;
  invitationUsed: boolean;
  /** Pratiques passées des 30 derniers jours : lues avant le début / assignées. */
  readBefore: number;
  pastTotal: number;
  /** Pratiques des 7 prochains jours : déjà lues / assignées. */
  upcomingRead: number;
  upcomingTotal: number;
}

export async function getCoachAccounts(coachIds: string[]): Promise<Map<string, CoachAccountStatus>> {
  const out = new Map<string, CoachAccountStatus>();
  if (!coachIds.length) return out;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [{ data: coaches }, { data: sessions }, { data: invites }, { data: asg }] = await Promise.all([
    db().from("coaches").select("id, password_hash").in("id", coachIds),
    db().from("coach_sessions").select("coach_id, created_at, token").in("coach_id", coachIds).order("created_at", { ascending: false }).limit(500),
    db().from("coach_password_resets").select("coach_id, purpose, created_at, used_at").in("coach_id", coachIds).order("created_at", { ascending: false }),
    db()
      .from("coach_assignments")
      .select("coach_id, status, practice_read_at, activity:coach_activities!inner(activity_date, start_time, activity_type, organization)")
      .in("coach_id", coachIds)
      .gte("activity.activity_date", addDays(today, -30))
      .lte("activity.activity_date", addDays(today, 7))
  ]);
  const now = Date.now();
  for (const id of coachIds) {
    const c = ((coaches ?? []) as any[]).find((x) => x.id === id);
    // Les sessions de test (« tmp… ») ne comptent pas comme une vraie connexion.
    const login = ((sessions ?? []) as any[]).find((s) => s.coach_id === id && !String(s.token).startsWith("tmp"));
    const used = ((invites ?? []) as any[]).filter((i) => i.coach_id === id);
    const invitation = used.find((i) => i.purpose === "invitation");
    const mine = ((asg ?? []) as any[]).filter((a) => a.coach_id === id && a.status !== "absent" && a.status !== "cancelled" && ["Pratique", "Camp"].includes(a.activity?.activity_type) && !a.activity?.organization);
    let readBefore = 0;
    let pastTotal = 0;
    let upcomingRead = 0;
    let upcomingTotal = 0;
    for (const a of mine) {
      const startMs = activityEndMs(String(a.activity.activity_date).slice(0, 10), String(a.activity.start_time).slice(0, 5));
      if (startMs <= now) {
        pastTotal++;
        if (a.practice_read_at && Date.parse(a.practice_read_at) <= startMs) readBefore++;
      } else {
        upcomingTotal++;
        if (a.practice_read_at) upcomingRead++;
      }
    }
    out.set(id, {
      coachId: id,
      activated: Boolean(c?.password_hash),
      lastLogin: login?.created_at ?? null,
      invitedAt: invitation?.created_at ?? null,
      invitationUsed: used.some((i) => i.purpose === "invitation" && i.used_at),
      readBefore,
      pastTotal,
      upcomingRead,
      upcomingTotal
    });
  }
  return out;
}

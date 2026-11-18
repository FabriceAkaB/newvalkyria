import { departureSignal, type DepartureSignal } from "@/lib/departure-signals";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Les familles à appeler parce que leur fille décroche (présences des 5 dernières semaines, inscriptions payées),
 *  sauf celles avec qui on a vraiment échangé dans les 14 derniers jours (outreach_log). */
export interface DepartureCall extends DepartureSignal {
  registrationId: string;
  playerName: string;
  parentName: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
}

const clean = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

export async function getDepartureCalls(today: string): Promise<DepartureCall[]> {
  const db = getSupabaseAdminClient() as any;
  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 35 * 86_400_000).toISOString().slice(0, 10);
  const recent = new Date(Date.parse(`${today}T12:00:00Z`) - 14 * 86_400_000).toISOString();
  const { data: marks } = await db.from("activity_player_attendance").select("registration_id, status, activity:coach_activities!inner(activity_date)").gte("activity.activity_date", since).lte("activity.activity_date", today).in("status", ["present", "absent"]);
  const byReg = new Map<string, { date: string; present: boolean }[]>();
  for (const m of (marks ?? []) as any[]) {
    if (!m.registration_id || !m.activity?.activity_date) continue;
    byReg.set(m.registration_id, [...(byReg.get(m.registration_id) ?? []), { date: String(m.activity.activity_date).slice(0, 10), present: m.status === "present" }]);
  }
  const signals = [...byReg.entries()].map(([id, list]) => ({ id, signal: departureSignal(list, today) })).filter((x) => x.signal);
  if (!signals.length) return [];
  const [{ data: regs }, { data: outreach }] = await Promise.all([
    db.from("registrations").select("id, status, player_first_name, player_last_name, parent_name, parent_email, parent_phone").in("id", signals.map((s) => s.id)),
    // Déjà contactée = un vrai échange avec la famille (réponse, refus, « plus tard », excuse) ou l'appel de signes de départ
    // déjà noté ; un envoi de masse (sondage, annonce) ne compte pas.
    db.from("outreach_log").select("registration_id, parent_email, kind, campaign").gte("sent_at", recent).or("kind.in.(reponse,refus,plus-tard,excuse),campaign.ilike.Signes de départ%")
  ]);
  const contacted = new Set(((outreach ?? []) as any[]).flatMap((o) => [o.registration_id, String(o.parent_email ?? "").toLowerCase()]).filter(Boolean));
  const regById = new Map(((regs ?? []) as any[]).map((r) => [r.id, r]));
  return signals
    .map(({ id, signal }) => ({ r: regById.get(id), id, signal: signal! }))
    .filter(({ r }) => r && r.status === "paid" && !contacted.has(r.id) && !contacted.has(String(r.parent_email ?? "").toLowerCase()))
    .map(({ r, id, signal }) => ({ ...signal, registrationId: id, playerName: `${clean(r.player_first_name)} ${clean(r.player_last_name)}`.trim(), parentName: r.parent_name ?? null, parentEmail: r.parent_email ?? null, parentPhone: r.parent_phone ?? null }));
}

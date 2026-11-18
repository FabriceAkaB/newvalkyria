import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Le pouls de l'académie, en haut de « Aujourd'hui » (maquette de JP, 17 nov. 2026, façon Stripe) : 4 indicateurs
 *  et l'activité récente (inscriptions, programmes, commandes, évaluations). Lectures seulement, données réelles. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface PulseStat {
  label: string;
  value: string;
  hint: string;
  href: string;
}
export interface PulseEvent {
  kind: "inscription" | "programme" | "commande" | "evaluation";
  title: string;
  detail: string;
  at: string;
  href: string;
}

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const money = (c: number) => (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export async function getPulse(role: "admin" | "gerante"): Promise<{ stats: PulseStat[]; events: PulseEvent[] }> {
  const today = todayIso();
  const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const since = addDays(today, -7);
  const { data: season } = await db().from("seasons").select("id, label").eq("is_active", true).maybeSingle();
  const seasonId = season?.id ?? "automne-hiver-2026";
  const [players, coaches, sessions, regs, programs, orders, evals, month] = await Promise.all([
    db().from("registrations").select("id", { count: "exact", head: true }).eq("season_id", seasonId).eq("status", "paid").eq("is_trial", false),
    db().from("coaches").select("id", { count: "exact", head: true }).eq("status", "active"),
    db().from("coach_activities").select("id, organization, activity_date").gte("activity_date", monday).lte("activity_date", addDays(monday, 6)),
    db().from("registrations").select("id, player_first_name, player_last_name, category_id, created_at, season_id").eq("status", "paid").neq("season_id", "demo").gte("created_at", `${since}T00:00:00`).order("created_at", { ascending: false }).limit(8),
    db().from("session_program_registrations").select("id, player_first_name, player_last_name, program_slug, created_at").eq("status", "paid").gte("created_at", `${since}T00:00:00`).order("created_at", { ascending: false }).limit(6),
    db().from("shop_orders").select("id, customer_name, total_cents, created_at").gte("created_at", `${since}T00:00:00`).order("created_at", { ascending: false }).limit(6),
    db().from("player_evaluations").select("activity_id, created_at, activity:coach_activities(title, category, activity_date, organization)").gte("created_at", `${since}T00:00:00`).order("created_at", { ascending: false }).limit(300),
    role === "admin"
      ? import("@/lib/revenue-calc")
          .then((m) => m.computeRevenueSummary())
          .then((s) => s.months.filter((x) => x.month === today.slice(0, 7)).reduce((a, x) => a + x.revenueCents, 0))
          .catch(() => null)
      : Promise.resolve(null)
  ]);
  const real = ((sessions.data ?? []) as any[]).filter((s) => !String(s.organization ?? "").startsWith("Démo"));
  const todayCount = real.filter((s) => String(s.activity_date).slice(0, 10) === today).length;

  const stats: PulseStat[] = [
    { label: "Joueuses inscrites", value: String(players.count ?? 0), hint: season?.label ?? "Saison en cours", href: "/admin/saison" },
    { label: "Éducateurs actifs", value: String(coaches.count ?? 0), hint: "Dans l'équipe", href: "/admin/coaching/joueuses" },
    role === "admin" && month !== null
      ? { label: "Encaissé ce mois", value: money(month), hint: new Date(`${today}T12:00:00Z`).toLocaleDateString("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" }), href: "/admin/revenus" }
      : { label: "Séances aujourd'hui", value: String(todayCount), hint: "Pratiques et matchs", href: "/admin/coaching" },
    { label: "Séances cette semaine", value: String(real.length), hint: "Pratiques et matchs prévus", href: "/admin/coaching/calendrier" }
  ];

  const name = (r: any) => `${String(r.player_first_name ?? "").trim()} ${String(r.player_last_name ?? "").trim()}`.trim();
  const events: PulseEvent[] = [
    ...((regs.data ?? []) as any[]).map((r) => ({ kind: "inscription" as const, title: "Nouvelle inscription", detail: `${name(r)}${r.category_id ? ` · Filles ${r.category_id}` : ""}`, at: r.created_at, href: `/admin/saison/${r.season_id}/inscriptions` })),
    ...((programs.data ?? []) as any[]).map((r) => ({ kind: "programme" as const, title: "Inscription à un programme", detail: `${name(r)} · ${r.program_slug}`, at: r.created_at, href: "/admin/inscriptions-garcons" })),
    ...((orders.data ?? []) as any[]).map((o) => ({ kind: "commande" as const, title: "Commande en boutique", detail: `${o.customer_name ?? "Client"}${role === "admin" && o.total_cents ? ` · ${money(o.total_cents)}` : ""}`, at: o.created_at, href: "/admin/boutique/commandes" }))
  ];
  // Évaluations : une ligne par pratique évaluée (pas une par joueuse).
  const byActivity = new Map<string, { n: number; at: string; label: string }>();
  for (const e of ((evals.data ?? []) as any[]).filter((x) => !String(x.activity?.organization ?? "").startsWith("Démo"))) {
    const cur = byActivity.get(e.activity_id);
    const d = String(e.activity?.activity_date ?? "").slice(0, 10);
    const label = `${e.activity?.title || e.activity?.category || "Pratique"}${d ? ` du ${d.slice(8, 10)}/${d.slice(5, 7)}` : ""}`;
    byActivity.set(e.activity_id, { n: (cur?.n ?? 0) + 1, at: cur && cur.at > e.created_at ? cur.at : e.created_at, label });
  }
  for (const [id, v] of byActivity) events.push({ kind: "evaluation", title: "Évaluations complétées", detail: `${v.label} · ${v.n} joueuse${v.n > 1 ? "s" : ""}`, at: v.at, href: `/admin/entraineurs/activites/${id}` });
  events.sort((a, b) => b.at.localeCompare(a.at));
  return { stats, events: events.slice(0, 7) };
}

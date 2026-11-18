import { average, lastMonths, monthlyAverages, trendOf } from "@/lib/program-satisfaction-core";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Satisfaction par programme : la saison filles par catégorie, chaque programme à dates fixes (garçons, camps,
 *  parascolaire, semi-privés). Règles : program-satisfaction-core.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface ProgramSatisfactionRow {
  key: string;
  label: string;
  kind: "saison" | "camp" | "parascolaire" | "programme";
  players: number;
  kids: { month: string; value: number | null; count: number }[];
  trend: "hausse" | "baisse" | "stable" | null;
  parents: { average: number | null; count: number };
}

const KIND = (k: string | null | undefined): ProgramSatisfactionRow["kind"] => (k === "camp" ? "camp" : k === "parascolaire" ? "parascolaire" : "programme");

export async function getProgramSatisfaction(today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }), months = 4): Promise<{ months: string[]; rows: ProgramSatisfactionRow[] }> {
  const ms = lastMonths(today, months);
  const since = `${ms[0]}-01`;
  const { data: season } = await db().from("seasons").select("id").eq("is_active", true).maybeSingle();
  const [{ data: regs }, { data: programs }, { data: spRegs }, { data: att }, { data: responses }] = await Promise.all([
    db().from("registrations").select("id, category_id, parent_email").eq("season_id", season?.id ?? "automne-hiver-2026").eq("status", "paid").eq("is_trial", false),
    db().from("session_programs").select("slug, name, program_kind"),
    db().from("session_program_registrations").select("program_slug, parent_email").eq("status", "paid"),
    db().from("activity_player_attendance").select("registration_id, practice_rating, activity:coach_activities(activity_date, organization)").not("practice_rating", "is", null).gte("activity.activity_date", since),
    db().from("survey_responses").select("recommend_score, created_at, invite:survey_invites(parent_email)").not("recommend_score", "is", null)
  ]);

  const rows = new Map<string, ProgramSatisfactionRow & { emails: Set<string>; ratings: { date: string; value: number }[]; regIds: Set<string> }>();
  const ensure = (key: string, label: string, kind: ProgramSatisfactionRow["kind"]) => {
    if (!rows.has(key)) rows.set(key, { key, label, kind, players: 0, kids: [], trend: null, parents: { average: null, count: 0 }, emails: new Set(), ratings: [], regIds: new Set() });
    return rows.get(key)!;
  };
  for (const r of (regs ?? []) as any[]) {
    const row = ensure(`saison:${r.category_id ?? "sans"}`, r.category_id ? `Saison filles ${r.category_id}` : "Saison filles (sans catégorie)", "saison");
    row.players++;
    row.regIds.add(r.id);
    if (r.parent_email) row.emails.add(String(r.parent_email).toLowerCase());
  }
  const nameOf = new Map(((programs ?? []) as any[]).map((p) => [p.slug, p]));
  for (const r of (spRegs ?? []) as any[]) {
    const p = nameOf.get(r.program_slug);
    const row = ensure(`programme:${r.program_slug}`, p?.name ?? r.program_slug, KIND(p?.program_kind));
    row.players++;
    if (r.parent_email) row.emails.add(String(r.parent_email).toLowerCase());
  }
  // Les camps et le parascolaire apparaissent dès qu'ils existent, même sans inscription.
  for (const p of (programs ?? []) as any[]) if (p.program_kind === "camp" || p.program_kind === "parascolaire") ensure(`programme:${p.slug}`, p.name, KIND(p.program_kind));

  const regToRow = new Map<string, string>();
  for (const row of rows.values()) for (const id of row.regIds) regToRow.set(id, row.key);
  for (const a of (att ?? []) as any[]) {
    if (!a.activity || a.activity.organization) continue;
    const key = regToRow.get(a.registration_id);
    if (key) rows.get(key)!.ratings.push({ date: String(a.activity.activity_date).slice(0, 10), value: Number(a.practice_rating) });
  }
  for (const r of (responses ?? []) as any[]) {
    const email = String(r.invite?.parent_email ?? "").toLowerCase();
    if (!email) continue;
    for (const row of rows.values()) if (row.emails.has(email)) {
      const total = (row.parents.average ?? 0) * row.parents.count + Number(r.recommend_score);
      row.parents.count++;
      row.parents.average = Math.round((total / row.parents.count) * 10) / 10;
    }
  }
  const out = [...rows.values()].map(({ emails: _e, ratings, regIds: _r, ...row }) => {
    void _e;
    void _r;
    const kids = monthlyAverages(ratings, ms);
    return { ...row, kids, trend: trendOf(kids), parents: { average: row.parents.count ? row.parents.average : average([]), count: row.parents.count } };
  });
  const order = { saison: 0, programme: 1, camp: 2, parascolaire: 3 } as const;
  out.sort((a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label, "fr"));
  return { months: ms, rows: out };
}

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { SeasonPlanEditor, type PlanRow } from "@/components/season-plan-editor";
import { requireAdmin } from "@/lib/admin-auth";
import { listPractices, SEASON } from "@/lib/practices-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { blockRuns, mondayOf, monthsWithoutTest, seasonWeeks } from "@/lib/season-plan";
import { getSeasonThemes } from "@/lib/season-themes-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Plan de l'année — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const monthLabel = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** « Quel thème travaille-t-on chaque semaine, en quels blocs, et quand sont les tests ? » (périodisation) */
export default async function SeasonPlanPage() {
  await requireAdmin({ roles: ["admin"] });
  const db = getSupabaseAdminClient() as any;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [themes, practices, { data: slots }, { data: cats }, { data: acts }] = await Promise.all([
    getSeasonThemes(SEASON_DB_ID),
    listPractices({ from: SEASON.start, to: SEASON.end }).catch(() => []),
    db.from("match_slots").select("slot_date").gte("slot_date", SEASON.start).lte("slot_date", SEASON.end),
    db.from("time_slot_template_categories").select("category_id, template:time_slot_templates(active)"),
    db.from("coach_activities").select("activity_date, activity_type").in("activity_type", ["Match", "Tournoi"]).gte("activity_date", SEASON.start).lte("activity_date", SEASON.end)
  ]);
  const weeks = seasonWeeks(SEASON);
  const themeOf = new Map(themes.map((t) => [String(t.week_start_date).slice(0, 10), t]));
  const categories = [...new Set(((cats ?? []) as any[]).filter((c) => c.template?.active).map((c) => String(c.category_id)))].sort();
  const matchDates = [...((slots ?? []) as any[]).map((s) => String(s.slot_date).slice(0, 10)), ...((acts ?? []) as any[]).map((a) => String(a.activity_date).slice(0, 10))];

  const rows: PlanRow[] = weeks.map((w) => {
    const t = themeOf.get(w.weekStart);
    const inWeek = (d: string) => mondayOf(d) === w.weekStart;
    const ps = practices.filter((p) => !p.organization && inWeek(p.date));
    return {
      weekStart: w.weekStart,
      closed: w.closed,
      theme: t?.theme ?? null,
      notes: t?.notes ?? null,
      blockLabel: t?.block_label ?? null,
      testWeek: Boolean(t?.test_week),
      byCategory: t?.by_category ?? {},
      practices: ps.length,
      ready: ps.filter((p) => p.readiness === "prete").length,
      matches: matchDates.filter(inWeek).length
    };
  });

  const open = rows.filter((r) => !r.closed);
  const upcoming = open.filter((r) => r.weekStart >= mondayOf(today));
  const withTheme = open.filter((r) => r.theme).length;
  const runs = blockRuns(weeks, (w) => themeOf.get(w)?.block_label);
  const badRuns = runs.filter((r) => !r.ok);
  // Mois à venir (le mois en cours compris) qui n'ont pas encore leur semaine de tests.
  const noTest = monthsWithoutTest(weeks.filter((w) => w.month >= today.slice(0, 7)), (w) => Boolean(themeOf.get(w)?.test_week));
  const nextWithout = upcoming.find((r) => !r.theme);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · plan de la saison</p>
            <h1 className="mda-h1">{withTheme ? `${withTheme} semaine${withTheme > 1 ? "s" : ""} sur ${open.length} ont leur thème` : "Le plan de l'année est à écrire"}</h1>
            <p className="mda-lead">
              Un thème par semaine (et un thème propre à une catégorie au besoin), regroupés en blocs de 4 à 6 semaines, avec une semaine de tests chaque mois. Les éducateurs voient le thème dans leur briefing et leur pratique du jour.
              {nextWithout ? ` Prochaine semaine sans thème : ${dayLabel(nextWithout.weekStart)}.` : ""}
            </p>
          </header>

          <section className="mda-cols-4">
            <div className="mda-card">
              <p className="mda-num">{upcoming.filter((r) => r.theme).length}/{upcoming.length}</p>
              <p className="mda-label">Semaines à venir avec un thème</p>
            </div>
            <div className="mda-card">
              <p className="mda-num" style={{ color: badRuns.length ? "var(--adm-warn)" : undefined }}>{runs.length}</p>
              <p className="mda-label">{badRuns.length ? `Blocs, dont ${badRuns.length} hors de 4 à 6 semaines` : "Blocs de 4 à 6 semaines"}</p>
            </div>
            <div className="mda-card">
              <p className="mda-num" style={{ color: noTest.length ? "var(--adm-warn)" : "var(--adm-good)" }}>{noTest.length}</p>
              <p className="mda-label">{noTest.length ? `Mois sans semaine de tests : ${noTest.map(monthLabel).join(", ")}` : "Chaque mois a sa semaine de tests"}</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{upcoming.reduce((s, r) => s + r.matches, 0)}</p>
              <p className="mda-label">Matchs au calendrier d&apos;ici la fin de la saison</p>
            </div>
          </section>

          {badRuns.length > 0 && (
            <section className="mda-card">
              <h2 className="mda-h2" style={{ marginBottom: 8 }}>Blocs à ajuster</h2>
              {badRuns.map((r) => (
                <p key={`${r.label}-${r.start}`} className="mda-lead" style={{ margin: "4px 0" }}>
                  <Pill tone="warn">{r.weeks} semaine{r.weeks > 1 ? "s" : ""}</Pill> {r.label} (à partir du {dayLabel(r.start)}) : un bloc fait 4 à 6 semaines.
                </p>
              ))}
            </section>
          )}

          <SeasonPlanEditor seasonId={SEASON_DB_ID} rows={rows} categories={categories} currentWeek={mondayOf(today)} />
        </div>
      </div>
    </>
  );
}

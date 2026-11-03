import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { WeeklyReviewForm } from "@/components/weekly-review-form";
import { requireAdmin } from "@/lib/admin-auth";
import { todayIso } from "@/lib/practices-repo";
import { isComplete, previousWeek, REVIEW_QUESTIONS, reviewWeekFor, weekLabel } from "@/lib/weekly-review";
import { getReviews } from "@/lib/weekly-review-repo";

export const metadata = { title: "Mandalart — Bilan de la semaine", robots: "noindex" };
export const dynamic = "force-dynamic";

/** « Qu'est-ce qui a marché, qu'est-ce que je change, quelle est LA priorité ? » : le bilan de JP, chaque semaine. */
export default async function WeeklyReviewPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const today = todayIso();
  const due = reviewWeekFor(today);
  const { semaine } = await searchParams;
  const reviews = await getReviews(52).catch(() => []);
  const weekStart = semaine && /^\d{4}-\d{2}-\d{2}$/.test(semaine) ? semaine : due.weekStart;
  const current = reviews.find((r) => r.weekStart === weekStart) ?? null;
  const priority = reviews.find((r) => r.weekStart === previousWeek(today))?.nextPriority ?? null;
  const done = isComplete(current);
  const past = reviews.filter((r) => r.weekStart !== weekStart);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda" style={{ maxWidth: 760 }}>
          <header>
            <p className="mda-eyebrow">Chaque semaine · 3 questions, 5 minutes</p>
            <h1 className="mda-h1">{done ? `Bilan de la semaine ${weekLabel(weekStart)} fait` : `Bilan de la semaine ${weekLabel(weekStart)}`}</h1>
            <p className="mda-lead">À faire le vendredi ou au plus tard le lundi. Ta réponse n° 3 devient ta priorité n° 1 : elle reste affichée en haut de « Aujourd&apos;hui » toute la semaine.</p>
          </header>

          {priority && (
            <section className="mda-card" style={{ borderColor: "var(--adm-accent)" }}>
              <p className="mda-label" style={{ marginTop: 0 }}>Ta priorité n° 1 cette semaine</p>
              <p style={{ margin: "4px 0 0", fontSize: "1.1rem", fontWeight: 600, color: "var(--adm-text)", whiteSpace: "pre-wrap" }}>{priority}</p>
            </section>
          )}

          <section className="mda-card">
            <div className="mda-card-head" style={{ padding: 0, marginBottom: 8 }}>
              <h2 className="mda-h2" style={{ margin: 0 }}>Semaine {weekLabel(weekStart)}</h2>
              <Pill tone={done ? "good" : due.late && weekStart === due.weekStart ? "warn" : undefined}>{done ? "Fait" : due.late && weekStart === due.weekStart ? "À faire aujourd'hui" : "À faire"}</Pill>
            </div>
            <WeeklyReviewForm key={weekStart} weekStart={weekStart} initial={current} />
          </section>

          {past.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">Les bilans précédents</h2>
              </div>
              <ul className="mda-tasks">
                {past.map((r) => (
                  <li key={r.weekStart} className="mda-task" style={{ display: "block" }}>
                    <p className="mda-task-title" style={{ fontWeight: 600 }}>
                      <a href={`/admin/mandalart/semaine?semaine=${r.weekStart}`} style={{ color: "inherit" }}>Semaine {weekLabel(r.weekStart)}</a>
                    </p>
                    <dl style={{ margin: "6px 0 0", display: "grid", gap: 6 }}>
                      {REVIEW_QUESTIONS.map((q) => (
                        <div key={q.key}>
                          <dt style={{ fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{q.label}</dt>
                          <dd style={{ margin: 0, color: r[q.key] ? "var(--adm-text)" : "var(--adm-text-3)", whiteSpace: "pre-wrap", fontSize: "0.9rem" }}>{r[q.key] ?? "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

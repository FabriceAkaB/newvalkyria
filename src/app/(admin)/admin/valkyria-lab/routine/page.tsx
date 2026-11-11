import Link from "next/link";

import { Pill, capitalize } from "@/components/mandalart/ui";
import { RoutineEditor, type RoutineDraft } from "@/components/valkyria-lab-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { addMonths, listRoutines, monthOf, monthTitle, ofMonth, pickRoutine, todayIso, type LabRoutine } from "@/lib/valkyria-lab";

export const metadata = { title: "Routine du mois · Valkyria Lab — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const draftFrom = (r: LabRoutine, title: string): RoutineDraft => ({
  title,
  instructions: r.instructions ?? "",
  exercises: r.exercises.map((e) => ({ name: e.name, how: e.how ?? "", videoUrl: e.videoUrl ?? "" })),
  challenge: r.challenge ?? "",
  challengeVideoUrl: r.challenge_video_url ?? "",
  weeklyGames: r.weekly_games.map((g) => ({ name: g.title, how: g.how ?? "", videoUrl: g.videoUrl ?? "" }))
});

/** « Qu'est-ce que les familles pratiquent à la maison ce mois-ci ? » : la routine d'un mois, en brouillon ou publiée. */
export default async function LabRoutinePage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { mois } = await searchParams;
  const current = monthOf(todayIso());
  const month = mois && MONTH_RE.test(mois) ? mois : current;
  const routines = await listRoutines();
  const own = routines.find((r) => r.month === month) ?? null;
  // Un nouveau mois part de la routine précédente : on garde ce qui a marché.
  const previous = own ? null : (routines.filter((r) => r.month < month)[0] ?? routines[0] ?? null);
  const shown = pickRoutine(routines, current);
  const initial: RoutineDraft = own
    ? draftFrom(own, own.title)
    : previous
      ? draftFrom(previous, `Routine maison ${ofMonth(month)}`)
      : { title: `Routine maison ${ofMonth(month)}`, instructions: "", exercises: [], challenge: "", challengeVideoUrl: "", weeklyGames: [] };

  // Mois proposés : le mois passé, ce mois-ci, le mois prochain, puis les routines plus anciennes.
  const months = [...new Set([addMonths(current, 1), current, addMonths(current, -1), ...routines.map((r) => r.month)])].sort((a, b) => b.localeCompare(a)).slice(0, 8);
  const statusOf = (m: string) => routines.find((r) => r.month === m)?.status ?? null;

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 820 }}>
        <header>
          <p className="mda-eyebrow">
            Valkyria Lab · routine maison
            {shown ? ` · les familles voient en ce moment « ${shown.routine.title} »` : " · aucune routine en ligne"}
          </p>
          <h1 className="mda-h1" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            Routine {ofMonth(month)} {month.slice(0, 4)}
            {own?.status === "publie" ? <Pill tone="good">Publiée</Pill> : own ? <Pill tone="warn">Brouillon</Pill> : <Pill>À écrire</Pill>}
          </h1>
          <p className="mda-lead">
            Ce que la famille voit sur sa page : les consignes, chaque geste avec sa démonstration (vidéo YouTube ou Vimeo en « non répertoriée »), le défi du mois et le jeu de la semaine. Publiée, c’est
            elle que les familles voient pendant le mois {ofMonth(month)}.
          </p>
        </header>

        <nav aria-label="Mois" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {months.map((m) => {
            const st = statusOf(m);
            const on = m === month;
            return (
              <Link
                key={m}
                href={`/admin/valkyria-lab/routine?mois=${m}`}
                aria-current={on ? "page" : undefined}
                style={{
                  minHeight: 44,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 14px",
                  borderRadius: 999,
                  textDecoration: "none",
                  fontSize: "0.85rem",
                  fontWeight: on ? 600 : 500,
                  background: on ? "var(--adm-accent)" : "var(--adm-surface-2)",
                  color: on ? "#fff" : "var(--adm-text-2)"
                }}
              >
                {capitalize(monthTitle(m))}
                {st === "publie" ? <span aria-label="publiée">✓</span> : st === "brouillon" ? <span className={on ? undefined : "mda-muted"}>· brouillon</span> : null}
                {m === current ? <span className={on ? undefined : "mda-muted"}>· ce mois-ci</span> : null}
              </Link>
            );
          })}
        </nav>

        <section className="mda-card">
          <RoutineEditor
            key={month}
            month={month}
            monthTitle={monthTitle(month)}
            routineId={own?.id ?? null}
            status={own?.status ?? null}
            initial={initial}
            prefilledFrom={!own && previous ? monthTitle(previous.month) : null}
            previewHref={`/lab/apercu?mois=${month}`}
          />
        </section>

        <p className="mda-label" style={{ margin: 0, color: "var(--adm-text-3)" }}>
          Démonstrations : téléversez la vidéo sur YouTube (visibilité « Non répertoriée ») ou Vimeo, puis collez le lien. Aucune vidéo de joueuse ici : seulement les démonstrations des
          coachs. Après la publication, envoyez le courriel du mois dans{" "}
          <Link href="/admin/valkyria-lab/familles" style={{ color: "var(--adm-accent)" }}>
            Liens des familles
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

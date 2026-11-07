import { HabitEditor, HabitsBoard } from "@/components/jp-space";
import { Bar } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { weekScore } from "@/lib/jp-core";
import { getHabits, getHabitsView } from "@/lib/jp-repo";

export const metadata = { title: "Mes habitudes — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });

/** Suivi des habitudes de JP : sommeil, coucher, entraînement, lecture, travail profond, contenu, eau. */
export default async function HabitudesPage() {
  await requireAdmin({ roles: ["admin"] });
  const [view, all] = await Promise.all([getHabitsView(), getHabits(true)]);
  const score = weekScore(view.weeks);
  const sleep = view.weeks.find((w) => /sommeil/i.test(w.habit.name));
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Je suis la première ressource de l&apos;académie</p>
          <h1 className="mda-h1">{score === null ? "Mes habitudes" : `Semaine réussie à ${Math.round(score * 100)} %`}</h1>
          <p className="mda-lead">Touche une case pour la cocher. Pour le sommeil et l&apos;eau, écris le nombre (ex. 7,5) : la case devient verte quand la cible est atteinte. Une journée pas encore notée ne casse pas ta série.</p>
        </header>

        <section className="mda-cols-3">
          <div className="mda-card">
            <p className="mda-num">{score === null ? "—" : `${Math.round(score * 100)} %`}</p>
            <p className="mda-label">Habitudes tenues cette semaine</p>
          </div>
          <div className="mda-card">
            <p className="mda-num" style={{ color: sleep?.average !== null && sleep?.average !== undefined && sleep.average < sleep.habit.target ? "var(--adm-warn)" : undefined }}>
              {sleep?.average ?? "—"} h
            </p>
            <p className="mda-label">Sommeil moyen cette semaine (cible {sleep?.habit.target ?? 7.5} h)</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{Math.max(0, ...view.weeks.map((w) => w.streak))}</p>
            <p className="mda-label">Plus longue série en cours (jours)</p>
          </div>
        </section>

        <section className="mda-card" style={{ overflowX: "auto" }}>
          <HabitsBoard
            today={view.today}
            weeks={view.weeks.map((w) => ({ id: w.habit.id, name: w.habit.name, kind: w.habit.kind, unit: w.habit.unit, target: w.habit.target, days: w.days, met: w.met, goal: w.goal, streak: w.streak, average: w.average }))}
          />
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>Les 8 dernières semaines</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {view.history.map((h) => (
              <li key={h.monday} style={{ display: "grid", gridTemplateColumns: "90px minmax(0, 1fr) 48px", gap: 10, alignItems: "center", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--adm-text-3)" }}>{short(h.monday)}</span>
                <Bar value={h.score ?? 0} thin />
                <span className="mda-tnum">{h.score === null ? "—" : `${Math.round(h.score * 100)} %`}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>Mes habitudes</h2>
          <HabitEditor habits={all.map((h) => ({ id: h.id, name: h.name, kind: h.kind, unit: h.unit, target: h.target, active: h.active }))} />
        </section>
      </div>
    </div>
  );
}

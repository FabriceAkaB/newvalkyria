import Link from "next/link";
import { notFound } from "next/navigation";

import { ExerciseDiagramView } from "@/components/exercise-diagram";
import { PrintButton } from "@/components/print-button";
import { isMethodOpen } from "@/lib/coach-access-core";
import { requireCoach } from "@/lib/coach-auth";
import { cleanCategory, getActivityRoster, getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { getExercisesForPlanning } from "@/lib/exercises-repo";
import { planBlocks } from "@/lib/practice-plan-view";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getThemeForDate, themeFor } from "@/lib/season-themes-repo";
import { getBlocksForActivity } from "@/lib/session-plan-repo";

export const metadata = { title: "Pratique à imprimer — Espace Technique" };
export const dynamic = "force-dynamic";

const hhmm = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
/** Ce qui fait progresser les filles pendant l'exercice : mis en évidence sur la feuille (JP, 18 nov. 2026). */
const EVOLVE = ["Variantes", "Progressions"];

/** La pratique sur papier (JP, 18 nov. 2026 : « je veux qu'à mon arrivée, la pratique soit imprimée ») : montage du
 *  terrain, matériel, consignes, variantes et progressions de chaque bloc, avec les heures. Une feuille à garder sur soi. */
export default async function PrintPractice({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const { id } = await params;
  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry) notFound();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  if (!isMethodOpen(entry.activity, today)) notFound();
  const activity = entry.activity;
  const date = String(activity.activity_date).slice(0, 10);
  const blocks = await getBlocksForActivity(id);
  const [exercises, theme, roster] = await Promise.all([
    getExercisesForPlanning(activity.activity_date, blocks.map((b) => b.exercise_id)),
    getThemeForDate(SEASON_DB_ID, new Date(`${date}T12:00:00`)).catch(() => null),
    getActivityRoster(activity).catch(() => [])
  ]);
  const plan = planBlocks(blocks, exercises as unknown as Record<string, unknown>[], String(activity.start_time), Math.max(roster.length, 1));
  const themeText = theme ? themeFor(theme, cleanCategory(activity.category)) ?? theme.theme : null;
  const when = new Date(`${date}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="print-sheet">
      <div className="no-print" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <Link href={`/entraineur/activites/${id}`} className="coach-secondary" style={{ textDecoration: "none" }}>← Retour à la pratique</Link>
        <PrintButton label="🖨 Imprimer la pratique" />
      </div>
      <header className="print-sheet__head">
        <p className="print-sheet__eyebrow">New Valkyria · {when} · {String(activity.start_time).slice(0, 5).replace(":", " h ")} à {String(activity.end_time).slice(0, 5).replace(":", " h ")}</p>
        <h1>{activity.title || activity.category || "Pratique"}</h1>
        <p>{activity.location ? activity.location.split(/\s[–-]\s/)[0] : ""}{roster.length ? ` · ${roster.length} joueuses attendues` : ""}</p>
        {themeText && (
          <div className="print-sheet__theme">
            <strong>Thème : {themeText}</strong>
            {theme?.notes ? <p>{theme.notes}</p> : null}
            <p>Je ne corrige que le thème · 3 interventions au plus par exercice, ensuite on laisse jouer.</p>
          </div>
        )}
      </header>

      {plan.length === 0 ? (
        <p>Le plan de cette pratique n&apos;est pas encore prêt. Reviens quand JP l&apos;aura préparé.</p>
      ) : (
        <>
          <table className="print-sheet__timing">
            <thead>
              <tr><th>Heure</th><th>Bloc</th><th>Durée</th></tr>
            </thead>
            <tbody>
              {plan.map((b) => (
                <tr key={b.id}>
                  <td>{hhmm(b.from)} à {hhmm(b.from + b.minutes)}</td>
                  <td>{b.type} · {b.title}</td>
                  <td>{b.minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>

          {plan.map((b, i) => (
            <section key={b.id} className="print-sheet__block">
              <h2>
                <span>{i + 1}. {b.title}</span>
                <span>{hhmm(b.from)} à {hhmm(b.from + b.minutes)} · {b.minutes} min</span>
              </h2>
              <p className="print-sheet__type">{b.type}</p>
              <div className="print-sheet__body">
                <dl>
                  {b.rows.filter((r) => !EVOLVE.some((e) => r.label.startsWith(e))).map((r) => (
                    <div key={r.label}>
                      <dt>{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
                {b.diagram ? <div className="print-sheet__diagram"><ExerciseDiagramView diagram={b.diagram as never} /></div> : null}
              </div>
              {b.rows.some((r) => EVOLVE.some((e) => r.label.startsWith(e))) && (
                <div className="print-sheet__evolve">
                  {b.rows.filter((r) => EVOLVE.some((e) => r.label.startsWith(e))).map((r) => (
                    <div key={r.label}>
                      <strong>{r.label}</strong>
                      <p>{r.value}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="print-sheet__notes">Mes notes : ______________________________________________________________</p>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

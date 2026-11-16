import { ExerciseDiagramView } from "@/components/exercise-diagram";
import { exerciseCard } from "@/lib/exercise-bank";
import type { BankEntry } from "@/lib/exercises-repo";

/** La fiche d'un exercice présentée comme une diapo des pratiques : titre, pastilles, but du jeu, règles,
 *  conseils de l'éducateur à gauche ; le schéma (photo) en grand et les comportements attendus à droite.
 *  `onAddPhoto` : bouton quand l'exercice n'a ni photo ni schéma. */
export function ExerciseSheetCard({ entry, onAddPhoto }: { entry: BankEntry; onAddPhoto?: () => void }) {
  const c = exerciseCard(entry);
  const List = c.numbered ? "ol" : "ul";
  return (
    <article className="xc-card" aria-label={`Fiche de l'exercice ${entry.title}`}>
      <header className="xc-head">
        <h2 className="xc-title">{entry.title}</h2>
        {c.theme ? <span className="xc-theme">{c.theme}</span> : null}
      </header>
      <div className="xc-chips">
        {c.chips.map((chip) => (
          <span key={chip} className="xc-chip">
            {chip}
          </span>
        ))}
        <span className="xc-chip xc-chip--dark" aria-label={`Difficulté ${c.difficulty} sur 3`}>
          Difficulté
          <span className="xc-dots" aria-hidden>
            {[1, 2, 3].map((d) => (
              <i key={d} data-on={d <= c.difficulty || undefined} />
            ))}
          </span>
        </span>
      </div>

      <div className="xc-body">
        <div className="xc-left">
          {c.goals.length ? (
            <section className="xc-sec">
              <h3>But du jeu</h3>
              <ul>{c.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </section>
          ) : null}
          {c.rules.length ? (
            <section className="xc-sec">
              <h3>{c.numbered ? "Les gestes" : c.goals.length ? "Règles" : "Déroulement"}</h3>
              <List>{c.rules.map((r, i) => <li key={i}>{r}</li>)}</List>
            </section>
          ) : null}
          {c.objectives.length || c.animation.length ? (
            <section className="xc-sec xc-tips">
              <h3>Conseils de l’éducateur</h3>
              {c.objectives.length ? (
                <>
                  <h4>Objectifs</h4>
                  <ul>{c.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
                </>
              ) : null}
              {c.animation.map((a) => (
                <div key={a.label}>
                  <h4>{a.label === "Questions" ? "Questions à poser" : a.label}</h4>
                  <ul>{a.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <div className="xc-right">
          <div className="xc-visual">
            {entry.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.image_url} alt={`Schéma : ${entry.title}`} />
            ) : entry.diagram_data ? (
              <ExerciseDiagramView diagram={entry.diagram_data} />
            ) : (
              <div className="xc-empty">
                <p>Pas encore de schéma.</p>
                {onAddPhoto ? (
                  <button type="button" className="xc-empty-btn" onClick={onAddPhoto}>
                    Ajouter une photo
                  </button>
                ) : null}
              </div>
            )}
          </div>
          {c.behaviours.length ? (
            <section className="xc-behave">
              <h3>Comportements attendus</h3>
              <ul>{c.behaviours.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="xc-foot">
        <span>New Valkyria · Banque d’exercices{entry.age_groups?.length ? ` ${entry.age_groups.join(", ")}` : ""}</span>
        {entry.video_url ? (
          <a href={entry.video_url} target="_blank" rel="noreferrer">
            Voir la vidéo ↗
          </a>
        ) : null}
      </footer>
    </article>
  );
}

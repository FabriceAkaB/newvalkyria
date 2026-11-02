import { CoachTopbar } from "@/components/coach-topbar";
import { requireCoach } from "@/lib/coach-auth";
import { familyLabel, PROGRESSION_STEPS } from "@/lib/coaching-method";
import { getGestures, getPrinciples, getStructure } from "@/lib/coaching-method-repo";
import { getCoach } from "@/lib/coaches-repo";
import { LEVEL_LABEL, PASSPORT_LEVELS } from "@/lib/skill-tests";

export const metadata = { title: "Méthode Valkyria — Espace Technique" };
export const dynamic = "force-dynamic";

/** La méthode Valkyria pour l'éducateur (lecture seule) : structure de séance, principes et gestes par niveau. */
export default async function CoachMethodPage() {
  const coachId = await requireCoach();
  const [coach, structure, principles, gestures] = await Promise.all([getCoach(coachId), getStructure(), getPrinciples(), getGestures({ activeOnly: true })]);
  const total = structure.blocks.reduce((s, b) => s + b.minutes, 0);

  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="coach-page">
          <h1 className="coach-title">La méthode Valkyria</h1>
          <p className="coach-sub">Comment se déroule chaque séance, ce qu&apos;on défend et les gestes à enseigner à chaque niveau.</p>

          <section style={{ marginTop: 24 }}>
            <h2 className="coach-h2">Une séance · {total} min</h2>
            {structure.blocks.map((b, i) => (
              <div key={i} className="coach-block">
                <div className="coach-block__head">
                  <p className="coach-block__title">{b.label}</p>
                  <span className="coach-block__time">{b.minutes} min</span>
                </div>
                <dl>
                  {b.objective && <div><dt>Objectif</dt><dd>{b.objective}</dd></div>}
                  {b.rules && <div><dt>Règles</dt><dd>{b.rules}</dd></div>}
                </dl>
              </div>
            ))}
          </section>

          <section style={{ marginTop: 24 }}>
            <h2 className="coach-h2">Nos principes</h2>
            <div className="coach-card">
              <ul className="coach-checklist">
                {principles.items.map((p, i) => (
                  <li key={i} data-done="true">
                    <span><strong style={{ color: "var(--adm-text)" }}>{p.title}</strong>{p.text ? ` : ${p.text}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section style={{ marginTop: 24 }}>
            <h2 className="coach-h2">Les gestes du passeport</h2>
            {gestures.length === 0 && <p className="coach-muted">La bibliothèque des gestes arrive bientôt.</p>}
            {[...PASSPORT_LEVELS, null].map((level) => {
              const list = gestures.filter((g) => g.passport_level === level);
              if (!list.length) return null;
              return (
                <div key={level ?? "aucun"} style={{ marginBottom: 16 }}>
                  <p className="coach-card__label">{level ? `Niveau ${LEVEL_LABEL[level]}` : "Autres gestes"}</p>
                  {list.map((g) => (
                    <div key={g.id} className="coach-block">
                      <div className="coach-block__head">
                        <div>
                          <p className="coach-block__type">{familyLabel(g.family)}</p>
                          <p className="coach-block__title">{g.name}</p>
                        </div>
                      </div>
                      <dl>
                        {g.execution && <div><dt>Exécution</dt><dd>{g.execution}</dd></div>}
                        {g.key_points.filter(Boolean).length > 0 && <div><dt>Points clés</dt><dd>{g.key_points.filter(Boolean).map((k) => `• ${k}`).join("\n")}</dd></div>}
                        {g.common_mistakes && <div><dt>Erreurs fréquentes</dt><dd>{g.common_mistakes}</dd></div>}
                        {PROGRESSION_STEPS.some((s) => g.progression?.[s.key]) && (
                          <div><dt>Progression</dt><dd>{PROGRESSION_STEPS.filter((s) => g.progression?.[s.key]).map((s, i) => `${i + 1}. ${s.label} : ${g.progression[s.key]}`).join("\n")}</dd></div>
                        )}
                      </dl>
                      {g.video_url && <a href={g.video_url} target="_blank" rel="noreferrer" className="coach-secondary" style={{ marginTop: 12 }}>Voir la démonstration ↗</a>}
                    </div>
                  ))}
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </>
  );
}

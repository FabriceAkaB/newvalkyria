import type { ModelPractice } from "@/lib/practice-history-repo";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Les pratiques notées 8 sur 10 et plus pour leur pertinence au thème : à reprendre telles quelles. */
export function ModelPractices({ practices }: { practices: ModelPractice[] }) {
  if (!practices.length) return null;
  return (
    <section className="mda-card-flush">
      <div className="mda-card-head">
        <h2 className="mda-h2">Pratiques modèles · 8/10 et plus</h2>
      </div>
      <ul className="mda-tasks">
        {practices.map((p) => (
          <li key={p.key} className="mda-task" style={{ display: "grid", gap: 6 }}>
            <p className="mda-task-title" style={{ fontWeight: 600, margin: 0, textTransform: "none" }}>
              <span style={{ textTransform: "capitalize" }}>{day(p.date)}</span> · Filles {p.group} · {p.themeScore}/10
            </p>
            <div className="mda-task-meta">
              {p.theme ? <span>Thème : {p.theme}</span> : null}
              {p.deckUrl ? <a href={p.deckUrl} target="_blank" rel="noreferrer" style={{ color: "var(--adm-accent)" }}>Ouvrir les diapos ↗</a> : null}
            </div>
            {p.blocks.length > 0 && (
              <ol style={{ margin: 0, paddingLeft: 18, color: "var(--adm-text)", fontSize: "0.88rem", display: "grid", gap: 2 }}>
                {p.blocks.map((b) => <li key={b.order}>{b.title}{b.minutes ? ` · ${b.minutes} min` : ""} <span style={{ color: "var(--adm-text-3)" }}>({b.type})</span></li>)}
              </ol>
            )}
            {p.analysisText ? <p className="mda-sub" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{p.analysisText}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

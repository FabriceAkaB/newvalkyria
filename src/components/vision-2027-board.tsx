import { WHO_LABEL, type VisionView } from "@/lib/vision-2027";

const SHORT_M = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const short = (iso: string | null) => {
  if (!iso) return "sans date";
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${SHORT_M[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

/** Les chantiers de la prochaine année : une carte par chantier (pourquoi, avancement, prochaine étape),
 *  les étapes dépliables. Composant serveur, sans montant : sert à JP et à la gérante. */
export function Vision2027Board({ projects, intro }: { projects: VisionView[]; intro?: string }) {
  return (
    <section style={{ marginBottom: "1.6rem" }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 4px", color: "var(--adm-text)" }}>🔭 À développer en 2027</h2>
      <p style={{ margin: "0 0 12px", fontSize: "0.88rem", color: "var(--adm-text-2)", lineHeight: 1.5 }}>
        {intro ?? "Les grands chantiers de la prochaine année. Chaque étape est une tâche du Mandalart : quand elle est cochée, le chantier avance tout seul."}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
        {projects.map((p) => {
          const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
          return (
            <details key={p.key} style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: 14, padding: 16 }}>
              <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <strong style={{ fontSize: "0.95rem", lineHeight: 1.3, color: "var(--adm-text)" }}>
                    {p.emoji} {p.title}
                  </strong>
                  <span style={{ fontSize: "0.72rem", color: "var(--adm-text-3)", whiteSpace: "nowrap" }}>{WHO_LABEL[p.who]}</span>
                </span>
                <span style={{ fontSize: "0.84rem", color: "var(--adm-text-2)", lineHeight: 1.45 }}>{p.why}</span>
                <span style={{ height: 6, borderRadius: 99, background: "var(--adm-line)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--adm-good)" }} />
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--adm-text-2)" }}>
                  <strong style={{ color: "var(--adm-text)" }}>
                    {p.done}/{p.total}
                  </strong>{" "}
                  {p.next ? (
                    <>
                      · Prochaine étape{p.next.late ? " (en retard)" : ""} : {p.next.title} <em>({short(p.next.due)})</em>
                    </>
                  ) : (
                    "· Terminé ✓"
                  )}
                </span>
                <span style={{ fontSize: "0.76rem", color: "var(--adm-text-3)" }}>Voir les étapes ▾</span>
              </summary>
              <ol style={{ margin: "10px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                {p.steps.map((s) => (
                  <li key={s.code} style={{ fontSize: "0.82rem", lineHeight: 1.4, color: s.done ? "var(--adm-text-3)" : "var(--adm-text)", textDecoration: s.done ? "line-through" : "none" }}>
                    {s.done ? "✓ " : ""}
                    {s.title}{" "}
                    <span style={{ color: s.late && !s.done ? "var(--adm-bad, #d9534f)" : "var(--adm-text-3)", textDecoration: "none" }}>
                      · {short(s.due)} · {s.owner ?? "à attribuer"}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          );
        })}
      </div>
    </section>
  );
}

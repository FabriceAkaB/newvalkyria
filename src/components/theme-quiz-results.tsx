import Link from "next/link";
import { Check, CircleHelp, X } from "lucide-react";

import { THEME_FAIL_LABEL, THEME_PASS_PCT, themeStatusOf, themeVerdict, type ThemeStatus } from "@/lib/theme-quiz-core";

/** « Qu'est-ce qu'on a travaillé aujourd'hui ? » dans l'admin (JP, 25 nov. 2026) : qui a compris le thème d'une
 *  pratique, et la part des filles qui l'ont trouvé, pratique par pratique. Jetons --adm-*, icônes Lucide. */

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** La part des filles qui ont trouvé le thème, pour chaque pratique (lien vers son sondage). */
export function ThemePracticeBars({ practices }: { practices: { activityId: string; date: string; start: string; label: string; theme: string | null; answered: number; understood: number; pct: number | null }[] }) {
  return (
    <ul className="svc-bars">
      {practices.map((p) => (
        <li key={p.activityId} className="svc-bar-row" style={{ gridTemplateColumns: "minmax(0, 1.5fr) minmax(60px, 1fr) 72px" }} title={p.theme ? `Thème : ${p.theme}` : undefined}>
          <Link href={`/admin/coaching/sondage/${p.activityId}`} style={{ fontWeight: 600, color: "var(--adm-text)", textDecoration: "none", minWidth: 0 }}>
            <span style={{ textTransform: "capitalize" }}>{dayLabel(p.date)}</span> · {p.start.replace(":", " h ")} · {p.label.replace(/^Filles\s+/i, "")}
            <small style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.theme ?? "Thème"}</small>
          </Link>
          <span className="svc-bar-track" aria-hidden>
            <span className="svc-bar-fill" style={{ width: `${p.pct ?? 0}%`, display: "block", ...(themeVerdict(p.pct) === "echec" ? { background: "var(--adm-bad)" } : {}) }} />
          </span>
          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
            {p.pct ?? 0} %
            <small style={themeVerdict(p.pct) === "echec" ? { color: "var(--adm-bad)", fontWeight: 600 } : undefined}>{themeVerdict(p.pct) === "echec" ? "Échec" : `${p.understood} sur ${p.answered}`}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

const COLS: { key: ThemeStatus; label: string; icon: React.ReactNode; tone: string; soft: string }[] = [
  { key: "compris", label: "A compris", icon: <Check size={16} aria-hidden />, tone: "var(--adm-good)", soft: "var(--adm-good-soft)" },
  { key: "pas-compris", label: "N'a pas compris", icon: <X size={16} aria-hidden />, tone: "var(--adm-bad)", soft: "var(--adm-bad-soft)" },
  { key: "pas-repondu", label: "Pas répondu", icon: <CircleHelp size={16} aria-hidden />, tone: "var(--adm-text-2)", soft: "var(--adm-surface-2)" }
];

/** Qui a compris le thème d'une pratique : prénom + initiale, en 3 colonnes. Les absentes ne comptent pas. */
export function ThemeWhoCard({ theme, players }: { theme: string | null; players: { id: string; name: string; row: { theme_correct?: boolean | null; theme_answer?: string | null } | null }[] }) {
  const answered = players.filter((p) => themeStatusOf(p.row) !== "pas-repondu");
  if (!theme && !answered.length) return null;
  const ok = players.filter((p) => themeStatusOf(p.row) === "compris").length;
  const verdict = themeVerdict(answered.length ? Math.round((ok / answered.length) * 100) : null);
  return (
    <section className="mda-card" style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 className="mda-h2" style={{ margin: 0 }}>Qui a compris le thème ?</h2>
        <p style={{ margin: "4px 0 0", color: "var(--adm-text-2)", fontSize: "0.875rem" }}>
          {theme ? <>Thème : <strong style={{ color: "var(--adm-text)" }}>{theme}</strong>. </> : null}
          {answered.length ? `${ok} sur ${answered.length} l'ont trouvé parmi 3 choix sur la borne.` : "Pas encore de réponse sur la borne."}
        </p>
        {verdict === "echec" ? (
          <p style={{ margin: "8px 0 0", padding: "6px 10px", borderRadius: 8, background: "var(--adm-bad-soft)", color: "var(--adm-bad)", fontWeight: 600, fontSize: "0.875rem", display: "inline-block" }}>
            {THEME_FAIL_LABEL} : moins de {THEME_PASS_PCT} % l&apos;ont trouvé.
          </p>
        ) : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {COLS.map((c) => {
          const list = players.filter((p) => themeStatusOf(p.row) === c.key);
          return (
            <div key={c.key} style={{ display: "grid", gap: 6, alignContent: "start" }}>
              <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: c.tone, fontSize: "0.875rem" }}>
                <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: "50%", background: c.soft }}>{c.icon}</span>
                {c.label} ({list.length})
              </p>
              {list.length ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 2, fontSize: "0.875rem", color: "var(--adm-text)" }}>
                  {list.map((p) => (
                    <li key={p.id} title={c.key === "pas-compris" && p.row?.theme_answer ? `A choisi : ${p.row.theme_answer}` : undefined}>
                      {p.name}
                      {c.key === "pas-compris" && p.row?.theme_answer ? <span style={{ color: "var(--adm-text-3)" }}> · {p.row.theme_answer}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--adm-text-3)" }}>Personne</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

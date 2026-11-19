import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { fmt, type SeasonSummary, type Trend } from "@/lib/season-summary";

/** Résumé de saison d'une joueuse (P1.2.10) : elle comparée à elle-même, du début de la saison à maintenant.
 *  Sans état : utilisable dans le portail (composant client) comme dans une page serveur. */

const TREND: Record<Trend, { label: string; color: string; Icon: typeof TrendingUp }> = {
  hausse: { label: "en progrès", color: "var(--adm-good)", Icon: TrendingUp },
  stable: { label: "stable", color: "var(--adm-text-2)", Icon: Minus },
  baisse: { label: "en baisse", color: "var(--adm-warn)", Icon: TrendingDown }
};

const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });

function Bar({ value, max }: { value: number | null; max: number }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: "var(--adm-surface-3)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value === null ? 0 : (value / max) * 100}%`, background: "var(--adm-accent-strong)", borderRadius: 999 }} />
    </div>
  );
}

export function SeasonSummaryCard({ summary, firstName }: { summary: SeasonSummary; firstName: string }) {
  const { scales, gestures, attendance, observations, objectives } = summary;
  const empty = summary.practicesEvaluated === 0 && attendance.total === 0;
  return (
    <div className="coach-card" style={{ marginBottom: "1.5rem" }}>
      <p className="coach-card__label">Résumé de saison · depuis le {shortDate(summary.from)}</p>
      {empty ? (
        <p className="coach-muted" style={{ margin: 0 }}>Pas encore de présence ni d&apos;évaluation : le résumé se remplit après chaque pratique.</p>
      ) : (
        <>
          {summary.headline ? <p style={{ margin: "0 0 12px", fontWeight: 600, color: "var(--adm-text)" }}>{summary.headline}</p> : null}

          <div className="coach-summary-grid">
            {scales.map((s) => {
              const t = s.trend ? TREND[s.trend] : null;
              return (
                <div key={s.key} style={{ display: "grid", gap: 4 }}>
                  <p className="coach-muted" style={{ margin: 0 }}>{s.label}</p>
                  <p className="coach-figure">
                    {fmt(s.now)}
                    <span>/5</span>
                  </p>
                  <Bar value={s.now} max={5} />
                  <p className="coach-muted" style={{ margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    {t ? (
                      <>
                        <t.Icon size={14} aria-hidden style={{ color: t.color }} />
                        <span style={{ color: t.color, fontWeight: 600 }}>{t.label}</span>
                        <span>· début {fmt(s.start)}</span>
                      </>
                    ) : s.count ? (
                      `${s.count} pratique notée`
                    ) : (
                      "pas encore notée"
                    )}
                  </p>
                </div>
              );
            })}
            <div style={{ display: "grid", gap: 4 }}>
              <p className="coach-muted" style={{ margin: 0 }}>Assiduité</p>
              <p className="coach-figure">
                {attendance.rate ?? "—"}
                <span>%</span>
              </p>
              <Bar value={attendance.rate} max={100} />
              <p className="coach-muted" style={{ margin: 0 }}>
                {attendance.present} sur {attendance.total}
                {attendance.label ? ` · ${attendance.label.toLowerCase()}` : ""}
              </p>
            </div>
          </div>

          {attendance.total >= 8 && attendance.recentRate !== null && attendance.rate !== null && Math.abs(attendance.recentRate - attendance.rate) >= 15 ? (
            <p className="coach-sub" style={{ margin: "12px 0 0" }}>
              Ses 6 dernières pratiques : {attendance.recentRate} % de présence ({attendance.recentRate > attendance.rate ? "plus présente qu'avant" : "moins présente qu'avant"}).
            </p>
          ) : attendance.streak >= 4 ? (
            <p className="coach-sub" style={{ margin: "12px 0 0" }}>{attendance.streak} pratiques de suite sans manquer.</p>
          ) : null}

          {gestures.strong.length || gestures.toWork.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
              <div>
                <p className="coach-field__label" style={{ margin: "0 0 4px" }}>Ses gestes forts</p>
                <p className="coach-sub" style={{ margin: 0 }}>
                  {gestures.strong.length ? gestures.strong.map((g) => `${g.name} (${fmt(g.recent)}/10)`).join(", ") : "À venir : aucun geste à 7/10 ou plus pour l'instant."}
                </p>
              </div>
              <div>
                <p className="coach-field__label" style={{ margin: "0 0 4px" }}>À travailler</p>
                <p className="coach-sub" style={{ margin: 0 }}>
                  {gestures.toWork.length
                    ? gestures.toWork.map((g) => (g.recent !== null ? `${g.name} (${fmt(g.recent)}/10)` : `${g.name} (difficile ${g.difficult} fois)`)).join(", ")
                    : "Rien de noté comme difficile récemment."}
                </p>
              </div>
            </div>
          ) : null}
          {gestures.improved ? (
            <p className="coach-sub" style={{ margin: "8px 0 0" }}>
              Plus grand progrès de geste : {gestures.improved.name}, de {fmt(gestures.improved.first)} à {fmt(gestures.improved.recent)} sur 10.
            </p>
          ) : null}

          {observations.length ? (
            <div style={{ marginTop: 16 }}>
              <p className="coach-field__label" style={{ margin: "0 0 4px" }}>Ce que les éducateurs ont observé</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                {observations.map((o) => (
                  <li key={`${o.date}-${o.text}`} className="coach-sub" style={{ margin: 0 }}>
                    <span style={{ color: "var(--adm-text-3)" }}>{shortDate(o.date)} · </span>
                    {o.text}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {objectives.active.length ? (
            <p className="coach-sub" style={{ margin: "16px 0 0" }}>
              <strong style={{ color: "var(--adm-text)" }}>Objectif{objectives.active.length > 1 ? "s" : ""} de {firstName} :</strong> {objectives.active.join(" · ")}
              {objectives.closed ? ` (${objectives.closed} déjà fermé${objectives.closed > 1 ? "s" : ""})` : ""}
            </p>
          ) : null}

          <p className="coach-muted" style={{ margin: "12px 0 0" }}>
            {summary.practicesEvaluated} pratique{summary.practicesEvaluated > 1 ? "s" : ""} évaluée{summary.practicesEvaluated > 1 ? "s" : ""}. {firstName} est comparée à elle-même : ses premières pratiques notées, puis ses dernières.
          </p>
        </>
      )}
    </div>
  );
}

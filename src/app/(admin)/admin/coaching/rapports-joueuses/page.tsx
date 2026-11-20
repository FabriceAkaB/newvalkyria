import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { QUICK_CRITERIA, QUICK_SCALE } from "@/lib/coach-report";
import { disagreements } from "@/lib/player-reports";
import { getPlayerReports, listReportPractices, type PlayerReport } from "@/lib/player-reports-repo";

export const metadata = { title: "Rapports des joueuses — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const fr = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));
const SHORT: Record<string, string> = { "Ball mastery": "Ball mastery", Prestation: "Prestation", Attitude: "Attitude" };
const num: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };

/** Une fille à une pratique : la moyenne en un coup d'œil, puis, dépliées, la réponse de chaque éducateur. */
function ReportCard({ r, showPractice }: { r: PlayerReport; showPractice?: boolean }) {
  const gaps = disagreements(r.evaluations);
  return (
    <details className="mda-card" style={{ padding: 0 }}>
      <summary style={{ cursor: "pointer", padding: "14px 20px", display: "grid", gridTemplateColumns: "minmax(160px, 1.4fr) repeat(4, minmax(64px, 0.6fr))", gap: 12, alignItems: "center", listStyle: "none" }}>
        <span>
          <strong style={{ color: "var(--adm-text)" }}>{showPractice ? `${dayLabel(r.date)} · ${r.group}` : r.name}</strong>
          <span style={{ display: "block", fontSize: "0.75rem", color: "var(--adm-text-3)", marginTop: 2 }}>
            {r.evaluations.length > 1 ? `Moyenne de ${r.evaluations.length} éducateurs (${r.evaluations.map((e) => e.coachName).join(", ")})` : `Par ${r.evaluations[0]?.coachName ?? "—"}`}
            {gaps.length ? <span style={{ color: "var(--adm-warn)", fontWeight: 600 }}> · Écart sur {gaps.join(", ").toLowerCase()}</span> : null}
          </span>
        </span>
        {QUICK_CRITERIA.map((c) => (
          <span key={c} style={num}>
            <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--adm-text-3)" }}>{SHORT[c]}</span>
            <strong style={{ color: "var(--adm-text)" }}>{fr(r.merged.ratings[c])}</strong>
          </span>
        ))}
        <span style={num}>
          <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--adm-text-3)" }}>Moyenne /5</span>
          <strong style={{ color: "var(--adm-accent)", fontSize: "1.05rem" }}>{fr(r.merged.overall)}</strong>
        </span>
      </summary>
      <div style={{ padding: "0 20px 18px", display: "grid", gap: 14 }}>
        <div className="admin-table-wrap" style={{ margin: 0 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Éducateur</th>
                {QUICK_CRITERIA.map((c) => (
                  <th key={c} style={num}>{SHORT[c]}</th>
                ))}
                <th>Observation</th>
              </tr>
            </thead>
            <tbody>
              {r.evaluations.map((e) => (
                <tr key={e.coachId}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{e.coachName}</td>
                  {QUICK_CRITERIA.map((c) => (
                    <td key={c} style={num} title={QUICK_SCALE.find((s) => s.value === e.ratings[c])?.label}>{fr(e.ratings[c])}</td>
                  ))}
                  <td style={{ minWidth: 260, color: "var(--adm-text-2)", whiteSpace: "normal" }}>{e.comment ?? "—"}</td>
                </tr>
              ))}
              {r.evaluations.length > 1 ? (
                <tr>
                  <td style={{ fontWeight: 700 }}>Moyenne</td>
                  {QUICK_CRITERIA.map((c) => (
                    <td key={c} style={{ ...num, fontWeight: 700 }}>{fr(r.merged.ratings[c])}</td>
                  ))}
                  <td style={{ color: "var(--adm-text-3)" }}>Les deux réponses fusionnées</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {r.merged.gestures.length ? (
          <div>
            <p className="mda-label" style={{ margin: "0 0 6px" }}>Gestes du ball mastery (moyenne sur 10, du plus difficile au plus réussi)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {r.merged.gestures.map((g) => (
                <span key={g.name} className="mda-pill" data-tone={r.merged.difficult.includes(g.name) ? "warn" : undefined} title={g.scores > 1 ? `Moyenne de ${g.scores} éducateurs` : undefined}>
                  {g.name} · {fr(g.average)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {!showPractice ? (
          <Link href={`/admin/coaching/rapports-joueuses?joueuse=${r.registrationId}`} style={{ fontSize: "0.8125rem" }}>
            Tous les rapports de {r.name.split(" ")[0]}
          </Link>
        ) : null}
      </div>
    </details>
  );
}

/** « Qu'ont écrit les éducateurs sur chaque fille ? » (JP, 20 nov. 2026) : chaque réponse, puis leur moyenne. */
export default async function PlayerReportsPage({ searchParams }: { searchParams: Promise<{ pratique?: string; joueuse?: string }> }) {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const { pratique, joueuse } = await searchParams;

  if (joueuse && /^[0-9a-f-]{36}$/i.test(joueuse)) {
    const reports = await getPlayerReports(joueuse).catch(() => []);
    const name = reports[0]?.name ?? "Joueuse";
    const overall = reports.map((r) => r.merged.overall).filter((v): v is number => v !== null);
    return (
      <>
        <AdminTopbar />
        <div className="admin-content">
          <div className="admin-section mda">
            <header>
              <p className="mda-eyebrow">
                <Link href="/admin/coaching/rapports-joueuses">Rapports des joueuses</Link> · une joueuse
              </p>
              <h1 className="mda-h1">{name}</h1>
              <p className="mda-lead">
                {reports.length} pratique{reports.length > 1 ? "s" : ""} évaluée{reports.length > 1 ? "s" : ""}
                {overall.length ? ` · moyenne générale ${fr(overall.reduce((s, x) => s + x, 0) / overall.length)} sur 5` : ""}. Touche une pratique pour voir la réponse de chaque éducateur.
              </p>
            </header>
            {reports.length ? reports.map((r) => <ReportCard key={r.activityId} r={r} showPractice />) : <p className="admin-empty-text">Aucun rapport pour cette joueuse.</p>}
          </div>
        </div>
      </>
    );
  }

  const { practices, reports } = await listReportPractices(28).catch(() => ({ practices: [], reports: [] as PlayerReport[] }));
  const selected = practices.find((p) => p.activityId === pratique) ?? practices[0] ?? null;
  const shown = selected ? reports.filter((r) => r.activityId === selected.activityId).sort((a, b) => a.name.localeCompare(b.name, "fr")) : [];
  const girls = new Set(reports.map((r) => r.registrationId)).size;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · ce que les éducateurs ont écrit</p>
            <h1 className="mda-h1">{girls ? `${girls} joueuse${girls > 1 ? "s" : ""} évaluée${girls > 1 ? "s" : ""} ces 4 dernières semaines` : "Aucun rapport ces 4 dernières semaines"}</h1>
            <p className="mda-lead">Pour chaque pratique : la moyenne de chaque fille (ball mastery, prestation, attitude, sur 5). Touche une fille pour lire la réponse de chaque éducateur, ses gestes du ball mastery et l&apos;observation écrite. Quand deux éducateurs l&apos;ont évaluée, leurs réponses sont fusionnées en une moyenne ; un écart de 2 points ou plus est signalé.</p>
          </header>

          {practices.length ? (
            <section className="mda-card" style={{ display: "grid", gap: 8 }}>
              <p className="mda-label" style={{ margin: 0 }}>Pratique</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {practices.map((p) => {
                  const on = p.activityId === selected?.activityId;
                  return (
                    <Link
                      key={p.activityId}
                      href={`/admin/coaching/rapports-joueuses?pratique=${p.activityId}`}
                      className={on ? "admin-btn-primary" : "admin-btn-ghost"}
                      style={{ textDecoration: "none", whiteSpace: "nowrap" }}
                      aria-current={on ? "page" : undefined}
                    >
                      {dayLabel(p.date)} · {p.start.replace(":", " h ")} · {p.group} ({p.players})
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {selected ? (
            <section style={{ display: "grid", gap: 8 }}>
              <h2 className="mda-h2" style={{ margin: 0 }}>
                {dayLabel(selected.date)} · {selected.group}
              </h2>
              <p className="mda-muted" style={{ margin: 0 }}>
                {selected.players} fille{selected.players > 1 ? "s" : ""} évaluée{selected.players > 1 ? "s" : ""} par {selected.coaches.join(", ")}
                {selected.doubled ? ` · ${selected.doubled} par deux éducateurs ou plus` : ""}
              </p>
              {shown.map((r) => (
                <ReportCard key={r.registrationId} r={r} />
              ))}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}

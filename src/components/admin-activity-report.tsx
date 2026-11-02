"use client";

import { useEffect, useState } from "react";

import { QUICK_CRITERIA, type ReportStatus } from "@/lib/coach-report";

interface ReportPlayer {
  registrationId: string;
  name: string;
  isTrial: boolean;
  status: string | null;
  practiceRating: number | null;
  fatigue: number | null;
  evaluations: { coach: string; ratings: Record<string, number>; comment: string | null }[];
}

const STATUS: Record<string, string> = { present: "Présente", absent: "Absente", injured: "Blessée", late: "En retard", left_early: "Partie tôt" };

/** Rapport des éducateurs (lecture seule) : ce que l'éducateur a rempli dans son portail pour cette activité. */
export function AdminActivityReport({ activityId }: { activityId: string }) {
  const [data, setData] = useState<{ required: boolean; report: ReportStatus; players: ReportPlayer[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/coach-activities/${activityId}/report`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [activityId]);

  if (failed) return <p className="admin-empty-text">Rapport indisponible pour l&apos;instant.</p>;
  if (!data) return <p className="admin-empty-text">Chargement du rapport…</p>;
  if (!data.required) return null;

  const { report, players } = data;
  const ratings = players.map((p) => p.practiceRating).filter((v): v is number => v != null);
  const avg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Rapport des éducateurs</p>
      <div className="admin-stats" style={{ marginBottom: "0.75rem" }}>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Rapport</p>
          <p className="admin-stat-value" style={{ color: report.complete ? "var(--adm-good)" : "var(--adm-warn)" }}>{report.complete ? "Complet" : "Incomplet"}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Évaluées</p>
          <p className="admin-stat-value">{report.participated - report.evaluationsMissing.length}/{report.participated}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Note des joueuses</p>
          <p className="admin-stat-value">{avg ?? "—"}<span style={{ fontSize: "0.8rem", color: "var(--adm-text-3)" }}>/10</span></p>
        </div>
      </div>
      {!report.complete && (
        <p style={{ fontSize: "0.82rem", color: "var(--adm-warn)", margin: "0 0 0.75rem" }}>
          {[report.attendanceMissing.length ? `Présence à marquer : ${report.attendanceMissing.join(", ")}` : null, report.evaluationsMissing.length ? `À évaluer : ${report.evaluationsMissing.join(", ")}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Joueuse</th>
              <th>Présence</th>
              {QUICK_CRITERIA.map((c) => <th key={c}>{c}</th>)}
              <th>Note / fatigue</th>
              <th>Note de l&apos;éducateur</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const ev = p.evaluations[0];
              return (
                <tr key={p.registrationId}>
                  <td>{p.name}{p.isTrial ? " (essai)" : ""}</td>
                  <td>{p.status ? STATUS[p.status] ?? p.status : <span style={{ color: "var(--adm-warn)" }}>—</span>}</td>
                  {QUICK_CRITERIA.map((c) => <td key={c} style={{ fontVariantNumeric: "tabular-nums" }}>{ev?.ratings?.[c] ?? "—"}</td>)}
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.practiceRating ?? "—"} / {p.fatigue ?? "—"}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--adm-text-2)", minWidth: "14rem" }}>
                    {p.evaluations.map((e, i) => <span key={i} style={{ display: "block" }}>{e.comment}{p.evaluations.length > 1 ? ` (${e.coach})` : ""}</span>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

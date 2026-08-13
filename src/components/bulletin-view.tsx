import type { BulletinData } from "@/lib/coach-portal-repo";

const ATTENDANCE_LABELS: Record<string, string> = {
  present: "Présente", absent: "Absente", injured: "Blessée", late: "En retard", left_early: "Partie tôt"
};

export function BulletinView({ data, seasonLabel }: { data: BulletinData; seasonLabel?: string }) {
  const { player, attendanceCounts, totalActivities, criteriaAverages, evaluations, objectives } = data;
  const activeObjectives = objectives.filter((o) => o.active);
  const presentCount = attendanceCounts.present;
  const attendanceRate = totalActivities > 0 ? Math.round((presentCount / totalActivities) * 100) : null;

  return (
    <div className="bulletin-print" style={{ maxWidth: "720px" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", margin: 0 }}>
          Bulletin de progression — {player.firstName} {player.lastName}
        </p>
        <p style={{ fontSize: "0.82rem", color: "#9d9da0", margin: "0.25rem 0 0" }}>
          {seasonLabel ? `${seasonLabel} · ` : ""}{player.birthYear ? `Catégorie ${player.birthYear}` : ""}{player.advancedGroup ? " · Groupe avancé" : ""}
        </p>
        <p style={{ fontSize: "0.68rem", color: "#605f65", margin: "0.4rem 0 0" }}>
          Généré le {new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })} — basé uniquement sur les données enregistrées ci-dessous.
        </p>
      </div>

      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Présences</p>
      {totalActivities === 0 ? (
        <p className="admin-empty-text" style={{ marginBottom: "1.5rem" }}>Aucune présence enregistrée pour l&apos;instant.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1.5rem" }}>
          <div style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "0.7rem 1rem" }}>
            <p style={{ fontSize: "0.62rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.2rem" }}>Taux de présence</p>
            <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#7fd88f", margin: 0 }}>{attendanceRate}%</p>
          </div>
          {(Object.keys(attendanceCounts) as (keyof typeof attendanceCounts)[])
            .filter((status) => attendanceCounts[status] > 0)
            .map((status) => (
              <div key={status} style={{ background: "#17151e", border: "1px solid #302e36", borderRadius: "10px", padding: "0.7rem 1rem" }}>
                <p style={{ fontSize: "0.62rem", color: "#9d9da0", textTransform: "uppercase", margin: "0 0 0.2rem" }}>{ATTENDANCE_LABELS[status]}</p>
                <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", margin: 0 }}>{attendanceCounts[status]}</p>
              </div>
            ))}
        </div>
      )}

      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Évaluations — moyenne par critère</p>
      {criteriaAverages.length === 0 ? (
        <p className="admin-empty-text" style={{ marginBottom: "1.5rem" }}>Aucune évaluation enregistrée pour l&apos;instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1.5rem" }}>
          {criteriaAverages.map((c) => (
            <div key={c.criterion} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "0.78rem", color: "#c3c2c8", minWidth: "10rem" }}>{c.criterion}</span>
              <div style={{ flex: 1, height: "6px", background: "#1f1d25", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{ width: `${(c.average / 5) * 100}%`, height: "100%", background: "#c3a6ff" }} />
              </div>
              <span style={{ fontSize: "0.75rem", color: "#9d9da0", minWidth: "3rem", textAlign: "right" }}>{c.average}/5</span>
            </div>
          ))}
        </div>
      )}

      {activeObjectives.length > 0 && (
        <>
          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Objectifs individuels</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginBottom: "1.5rem" }}>
            {activeObjectives.map((o) => (
              <p key={o.id} style={{ fontSize: "0.8rem", color: "#c3c2c8", margin: 0 }}>• {o.objective}</p>
            ))}
          </div>
        </>
      )}

      <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Commentaires des entraîneurs</p>
      {evaluations.filter((e) => e.comment).length === 0 ? (
        <p className="admin-empty-text">Aucun commentaire enregistré pour l&apos;instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {evaluations.filter((e) => e.comment).map((e) => (
            <div key={e.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.6rem 0.85rem" }}>
              <p style={{ fontSize: "0.68rem", color: "#6d6b71", margin: "0 0 0.25rem" }}>
                {new Date(e.activity.activity_date).toLocaleDateString("fr-CA")} — {e.coach.first_name} {e.coach.last_name}
              </p>
              <p style={{ fontSize: "0.8rem", color: "#c3c2c8", margin: 0, fontStyle: "italic" }}>« {e.comment} »</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

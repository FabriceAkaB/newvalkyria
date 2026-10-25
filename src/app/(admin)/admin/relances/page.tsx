import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { getOutreachSummary, type OutreachStatus } from "@/lib/outreach";

export const metadata = { title: "Relances — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const money = (c: number) => (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "America/Toronto" });
const CHIP: Record<OutreachStatus, { label: string; color: string; bg: string }> = {
  inscrite: { label: "Inscrite", color: "#8fce9f", bg: "rgba(143,206,159,0.12)" },
  "offre-ouverte": { label: "Offre ouverte", color: "#f0c878", bg: "rgba(240,200,120,0.12)" },
  "en-attente": { label: "Pas inscrite", color: "#a0c8ff", bg: "rgba(160,200,255,0.12)" },
  "offre-expiree": { label: "Offre expirée", color: "#ff9999", bg: "rgba(255,153,153,0.12)" },
  "deja-inscrite": { label: "Erreur (déjà inscrite)", color: "#9d9da0", bg: "rgba(157,157,160,0.12)" }
};
const cell: React.CSSProperties = { padding: "0.55rem 0.5rem", borderBottom: "1px solid #1f1d25", fontSize: "0.8rem", color: "#c3c2c8", verticalAlign: "top", textAlign: "left" };
const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: 12, padding: "1rem", marginBottom: "1.25rem" };

export default async function OutreachPage() {
  await requireAdmin();
  const s = await getOutreachSummary();
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Relances et suivi</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1rem" }}>
            Chaque relance envoyée aux familles (courriels, offres, réponses) est notée ici. Le statut se met à jour tout seul : dès qu&apos;une joueuse relancée s&apos;inscrit, elle passe à « Inscrite ».
          </p>
          <div className="admin-stats" style={{ marginBottom: "1.2rem" }}>
            <div className="admin-stat-card admin-stat-card-accent"><p className="admin-stat-value">{s.totals.inscrites} / {s.totals.people}</p><p className="admin-stat-label">Joueuses inscrites après relance ({s.totals.conversionPct.toLocaleString("fr-CA")} %)</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{s.totals.relances}</p><p className="admin-stat-label">Relances envoyées</p></div>
            <div className="admin-stat-card admin-stat-card-warn"><p className="admin-stat-value">{s.totals.ouvertes}</p><p className="admin-stat-label">Offres encore ouvertes</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{money(s.totals.revenueCents)}</p><p className="admin-stat-label">Revenus des offres payées</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{s.totals.erreurs}</p><p className="admin-stat-label">Relancées par erreur (excuses envoyées)</p></div>
          </div>

          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Par campagne</p>
            <div className="admin-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead><tr>{["Campagne", "Relances", "Joueuses", "Inscrites"].map((h) => <th key={h} style={{ ...cell, color: "#8a8791" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {s.campaigns.map((c) => (
                    <tr key={c.campaign}><td style={{ ...cell, color: "#fff" }}>{c.campaign}</td><td style={cell}>{c.relances}</td><td style={cell}>{c.people}</td><td style={cell}>{c.inscrites}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Par joueuse ({s.people.length})</p>
            <div className="admin-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead><tr>{["Joueuse", "Parent", "Relances", "Dernière", "Historique", "Statut"].map((h) => <th key={h} style={{ ...cell, color: "#8a8791" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {s.people.map((p) => {
                    const chip = CHIP[p.status];
                    return (
                      <tr key={p.key}>
                        <td style={{ ...cell, color: "#fff", fontWeight: 600 }}>{p.playerName ?? "—"}</td>
                        <td style={cell}>{p.parentName}<span style={{ display: "block", color: "#6d6b71" }}>{p.parentEmail}</span></td>
                        <td style={{ ...cell, color: "#fff", fontWeight: 700 }}>{p.relances}{p.excuses ? <span style={{ color: "#6d6b71", fontWeight: 400 }}> + {p.excuses} excuse</span> : null}</td>
                        <td style={cell}>{day(p.lastAt)}</td>
                        <td style={cell}>
                          {p.history.map((h, i) => (
                            <span key={i} style={{ display: "block" }}>{day(h.at)} · {h.campaign}{h.kind === "excuse" ? " (excuse)" : h.kind === "reponse" ? " (réponse)" : ""}</span>
                          ))}
                        </td>
                        <td style={cell}>
                          <span style={{ display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700, color: chip.color, background: chip.bg }}>{chip.label}</span>
                          <span style={{ display: "block", color: "#6d6b71", marginTop: 4 }}>{p.statusDetail}</span>
                          {p.offerUrl ? <a href={p.offerUrl} target="_blank" rel="noreferrer" style={{ color: "#c3a6ff", fontSize: "0.75rem" }}>Voir l&apos;offre</a> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { AdminTopbar } from "@/components/admin-topbar";

function ExportCard({ title, description, href, filenameHint }: { title: string; description: string; href: string; filenameHint: string }) {
  return (
    <div style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px", padding: "1rem 1.2rem", marginBottom: "0.9rem" }}>
      <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", margin: "0 0 0.3rem" }}>{title}</p>
      <p style={{ fontSize: "0.78rem", color: "#9d9da0", margin: "0 0 0.8rem" }}>{description}</p>
      <a href={href} className="admin-btn-primary" style={{ display: "inline-block", fontSize: "0.78rem", padding: "0.5rem 1rem", textDecoration: "none" }}>
        ↓ Télécharger ({filenameHint})
      </a>
    </div>
  );
}

export function AdminExports() {
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Exports MonClubSportif</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Fichiers prêts pour l&apos;import sur MonClubSportif — la colonne <strong>ACTIVITÉ</strong> reste à compléter avec le nom exact tel qu&apos;il apparaît sur la plateforme (une seule fois par programme, avec le collage rapide de la plateforme).
          </p>

          <ExportCard
            title="Membres"
            description="Toutes les athlètes et joueurs actifs (hors annulés) — Été 2026, Automne/Hiver, Sport-Études, Privilège Valkyria, Programme Intensif — au format d'import des membres."
            href="/api/admin/export/membres-monclubsportif"
            filenameHint="membres-monclubsportif.xlsx"
          />

          <ExportCard
            title="Événements"
            description="Toutes les dates ajoutées à l'horaire Automne/Hiver, plus les séances à dates fixes de Sport-Études, Privilège Valkyria et Programme Intensif — au format d'import des événements."
            href="/api/admin/export/evenements-monclubsportif"
            filenameHint="evenements-monclubsportif.xlsx"
          />
        </div>
      </div>
    </>
  );
}

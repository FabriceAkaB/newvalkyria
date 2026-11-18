"use client";

export function FichePrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ background: "var(--adm-surface)", color: "var(--adm-text)", border: "1px solid var(--adm-border)", borderRadius: "6px", padding: "0.45rem 0.9rem", cursor: "pointer", fontSize: "0.8rem" }}
    >
      Imprimer / enregistrer en PDF
    </button>
  );
}

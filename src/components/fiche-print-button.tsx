"use client";

export function FichePrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{ background: "#2a1a45", color: "#fff", border: "none", borderRadius: "6px", padding: "0.45rem 0.9rem", cursor: "pointer", fontSize: "0.8rem" }}
    >
      Imprimer / enregistrer en PDF
    </button>
  );
}

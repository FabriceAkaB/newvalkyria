"use client";

/** Bouton « Imprimer ou enregistrer en PDF » (le navigateur propose « Enregistrer au format PDF »). */
export function PrintButton({ label = "Imprimer ou enregistrer en PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} style={{ background: "#5b2a86", color: "#fff", border: 0, borderRadius: 10, padding: "12px 20px", fontWeight: 700, cursor: "pointer" }}>
      {label}
    </button>
  );
}

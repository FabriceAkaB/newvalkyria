"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Point d'entrée "Entrer un code" pour des programmes indépendants du
 *  parcours d'inscription régulier (ex. code 215 → Sport-Études). Mécanisme
 *  séparé de invitation-gate.tsx : ici un code NAVIGUE vers une page
 *  distincte plutôt que de déverrouiller des options dans le même parcours. */
export function ProgramCodeGate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/programme-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Code invalide.");
      router.push(data.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide.");
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", color: "#9f85ba", fontSize: "0.78rem", textDecoration: "underline", cursor: "pointer", padding: 0 }}
      >
        Vous avez un code ?
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      <input
        className="insc-input"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code"
        style={{ width: "8rem" }}
      />
      <button type="submit" className="nv27-btn-primary" disabled={loading} style={{ padding: "0.4rem 0.9rem", fontSize: "0.78rem" }}>
        {loading ? "..." : "Valider"}
      </button>
      {error && <span style={{ fontSize: "0.72rem", color: "#f87171" }}>{error}</span>}
    </form>
  );
}

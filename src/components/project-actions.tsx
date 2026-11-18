"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Boutons d'une ligne de « Projets à lancer » : chiffrer (ouvre le calculateur) et mettre dans l'agenda de JP. */
export function ProjectActions({ projectKey, scenarioId, canSchedule, scheduled }: { projectKey: string; scenarioId: string | null; canSchedule: boolean; scheduled: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"chiffrer" | "agenda" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "chiffrer" | "agenda") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/projets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, key: projectKey }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      if (action === "chiffrer") router.push(`/admin/revenus/calculateur?scenario=${json.scenarioId}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
      {scenarioId ? (
        <a className="admin-btn-ghost" href={`/admin/revenus/calculateur?scenario=${scenarioId}`}>Ouvrir le calcul</a>
      ) : (
        <button type="button" className="admin-btn-ghost" disabled={busy !== null} onClick={() => run("chiffrer")}>{busy === "chiffrer" ? "…" : "Chiffrer"}</button>
      )}
      {canSchedule ? (
        scheduled ? (
          <span className="mda-pill" data-tone="good">Dans tes tâches</span>
        ) : (
          <button type="button" className="admin-btn-primary" disabled={busy !== null} onClick={() => run("agenda")}>{busy === "agenda" ? "…" : "Mettre dans mon agenda"}</button>
        )
      ) : null}
      {error ? <p role="alert" style={{ margin: 0, width: "100%", textAlign: "right", fontSize: "0.8125rem", color: "var(--adm-bad)" }}>{error}</p> : null}
    </div>
  );
}

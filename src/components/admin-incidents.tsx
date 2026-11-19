"use client";

import { useState } from "react";

import { Pill } from "@/components/mandalart/ui";
import { INCIDENT_STATUS, kindLabel, statusLabel } from "@/lib/player-incidents";
import type { PlayerIncident } from "@/lib/player-incidents-repo";

const fr = (iso: string) => new Date(iso.length > 10 ? iso : `${iso}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Toronto" });
const tone = (s: string) => (s === "ouverte" ? "bad" : s === "suivi" ? "warn" : "good") as "bad" | "warn" | "good";

/** Une fiche de blessure et son suivi : appel à la famille, notes, date de retour au jeu. */
export function IncidentRow({ initial }: { initial: PlayerIncident }) {
  const [i, setI] = useState(initial);
  const [followUp, setFollowUp] = useState(initial.followUp ?? "");
  const [returnOn, setReturnOn] = useState(initial.returnOn ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/coaching/blessures", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: i.id, followUp, returnOn, ...patch }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (res?.ok && json?.incident) setI(json.incident);
    else setError("Pas enregistré. Réessaie.");
  };

  return (
    <li style={{ display: "grid", gap: 8, padding: "14px 16px", borderTop: "1px solid var(--adm-line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>
            {i.playerName} · {kindLabel(i.kind)}{i.bodyPart ? ` (${i.bodyPart})` : ""}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
            {fr(i.activityDate ?? i.createdAt)}{i.activityLabel ? ` · ${i.activityLabel}` : ""} · signalée par {i.reportedBy ?? "un éducateur"}
          </p>
        </div>
        <Pill tone={tone(i.status)}>{statusLabel(i.status)}</Pill>
      </div>
      <p style={{ margin: 0, color: "var(--adm-text)", whiteSpace: "pre-line" }}>{i.description}</p>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        {i.firstAid ? `Premiers soins : ${i.firstAid} · ` : ""}
        {i.stoppedPlaying ? "a arrêté de jouer" : "a continué"} · {i.parentNotified ? "parent avisé" : <strong style={{ color: "var(--adm-bad)" }}>parent pas encore avisé</strong>}
      </p>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start" }}>
        <textarea className="admin-input" rows={2} placeholder="Suivi : appel à la famille, avis du médecin, ce qu'elle peut faire en attendant…" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
        <label style={{ display: "grid", gap: 2, fontSize: "0.8rem", color: "var(--adm-text-2)" }}>
          Retour au jeu
          <input type="date" className="admin-input" value={returnOn} onChange={(e) => setReturnOn(e.target.value)} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!i.parentNotified && (
          <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => save({ parentNotified: true, status: "suivi" })}>
            Famille appelée
          </button>
        )}
        {INCIDENT_STATUS.filter((s) => s.value !== i.status).map((s) => (
          <button key={s.value} type="button" className="admin-btn-ghost" disabled={busy} onClick={() => save({ status: s.value })}>
            {s.label}
          </button>
        ))}
        <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => save({})}>Enregistrer le suivi</button>
      </div>
      {error && <p style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p>}
    </li>
  );
}

"use client";

import { useEffect, useState } from "react";

import { HEAD_KNOCK_RULE, INCIDENT_KINDS, kindLabel } from "@/lib/player-incidents";

/** Blessure ou malaise pendant la pratique (JP, 18 nov. 2026) : la fiche en 1 minute, le téléphone du parent
 *  sous la main, et JP reçoit tout de suite la tâche d'appeler la famille. */

interface Contact { parentName: string | null; parentPhone: string | null; emergencyName: string | null; emergencyPhone: string | null; medicalNotes: string | null }
interface Incident { id: string; playerName: string; kind: string; bodyPart: string | null; description: string; reportedBy: string | null; parentNotified: boolean; stoppedPlaying: boolean }
interface Loaded { players: { id: string; name: string }[]; incidents: Incident[]; contacts: Record<string, Contact> }

const EMPTY = { registrationId: "", kind: "blessure", bodyPart: "", description: "", firstAid: "", stoppedPlaying: false, parentNotified: false };

export function CoachIncidentCard({ activityId }: { activityId: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    fetch(`/api/coach/activities/${activityId}/blessures`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Loaded | null) => d && setData(d))
      .catch(() => null);
  }, [activityId]);

  const set = (patch: Partial<typeof EMPTY>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
    setSent(false);
  };
  const contact = form.registrationId ? data?.contacts[form.registrationId] : null;
  const head = form.kind === "choc-tete";

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/coach/activities/${activityId}/blessures`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (!res?.ok) return setError(json?.error ?? "Pas enregistré : réessaie (ou écris à JP si le réseau ne passe pas).");
    setData((d) => (d ? { ...d, incidents: [...d.incidents, json.incident] } : d));
    setForm(EMPTY);
    setOpen(false);
    setSent(true);
  };

  return (
    <div className="coach-card" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p className="coach-card__label">Blessure ou malaise</p>
          <p className="coach-sub" style={{ margin: 0 }}>Une fille se blesse ? Remplis la fiche tout de suite : JP est avisé et appelle la famille.</p>
        </div>
        {!open && (
          <button type="button" className="coach-secondary" onClick={() => setOpen(true)}>
            Signaler une blessure
          </button>
        )}
      </div>

      {sent && <p className="coach-ok" style={{ margin: "10px 0 0" }}>✓ Fiche envoyée. JP a la tâche d&apos;appeler la famille.</p>}

      {(data?.incidents.length ?? 0) > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}>
          {data!.incidents.map((i) => (
            <li key={i.id} style={{ color: "var(--adm-text)" }}>
              <strong>{i.playerName}</strong> · {kindLabel(i.kind)}{i.bodyPart ? ` (${i.bodyPart})` : ""} · {i.parentNotified ? "parent avisé" : "parent pas encore avisé"}
              <span className="coach-muted"> · par {i.reportedBy ?? "un éducateur"}</span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>Joueuse</span>
            <select className="admin-input" value={form.registrationId} onChange={(e) => set({ registrationId: e.target.value })}>
              <option value="">Choisir…</option>
              {(data?.players ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          {contact && (
            <div style={{ padding: "8px 10px", borderRadius: 8, background: "var(--adm-surface-2)", border: "1px solid var(--adm-border)" }}>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>
                Parent : {contact.parentName ?? "—"}{" "}
                {contact.parentPhone ? <a href={`tel:${contact.parentPhone.replace(/[^\d+]/g, "")}`} style={{ color: "var(--adm-info)" }}>{contact.parentPhone}</a> : "(pas de téléphone au dossier)"}
              </p>
              {contact.emergencyPhone && <p className="coach-sub" style={{ margin: "4px 0 0" }}>Urgence : {contact.emergencyName ?? ""} {contact.emergencyPhone}</p>}
              {contact.medicalNotes && <p className="coach-sub" style={{ margin: "4px 0 0", color: "var(--adm-warn)" }}>Santé : {contact.medicalNotes}</p>}
            </div>
          )}

          <div className="coach-seg">
            {INCIDENT_KINDS.map((k) => (
              <button key={k.value} type="button" data-active={String(form.kind === k.value)} onClick={() => set({ kind: k.value })}>
                {k.label}
              </button>
            ))}
          </div>
          {head && <p className="coach-sub" style={{ margin: 0, color: "var(--adm-bad)", fontWeight: 600 }}>{HEAD_KNOCK_RULE}</p>}

          <input className="admin-input" placeholder="Où sur le corps ? (ex. genou gauche, cheville droite, tête)" value={form.bodyPart} onChange={(e) => set({ bodyPart: e.target.value })} />
          <textarea className="admin-input" rows={3} placeholder="Ce qui s'est passé : pendant quel exercice, comment, ce qu'elle ressent." value={form.description} onChange={(e) => set({ description: e.target.value })} />
          <textarea className="admin-input" rows={2} placeholder="Premiers soins donnés (ex. glace 15 min, repos sur le banc)" value={form.firstAid} onChange={(e) => set({ firstAid: e.target.value })} />
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--adm-text)" }}>
            <input type="checkbox" checked={head || form.stoppedPlaying} disabled={head} onChange={(e) => set({ stoppedPlaying: e.target.checked })} />
            Elle a arrêté de jouer
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--adm-text)" }}>
            <input type="checkbox" checked={form.parentNotified} onChange={(e) => set({ parentNotified: e.target.checked })} />
            Le parent est avisé (sur place ou par téléphone)
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="coach-primary" disabled={busy || !form.registrationId || !form.description.trim()} onClick={submit}>
              {busy ? "Envoi…" : "Envoyer la fiche"}
            </button>
            <button type="button" className="coach-secondary" onClick={() => { setOpen(false); setError(null); }}>Annuler</button>
          </div>
          {error && <p className="coach-error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

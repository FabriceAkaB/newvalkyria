"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Mon parcours : bouton « Demander la rencontre » (une tâche pour JP, une seule demande ouverte à la fois). */
export function FamilyMeetingRequest({ registrationId, firstName }: { registrationId: string; firstName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/compte/parcours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ registrationId, message }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "Pas envoyé : réessayez.");
    router.refresh();
  };

  if (!open) {
    return (
      <button type="button" className="nv27-btn-primary" onClick={() => setOpen(true)} style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 8, minHeight: 44, padding: "0 16px", border: 0, cursor: "pointer", font: "inherit", fontWeight: 600 }}>
        <CalendarPlus size={16} aria-hidden />
        Demander la rencontre
      </button>
    );
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label className="insc-field" style={{ display: "grid", gap: 6 }}>
        <span>Vos disponibilités ou ce dont vous aimeriez parler (facultatif)</span>
        <textarea className="insc-input" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Par exemple : après la pratique du samedi, ou ce qui préoccupe ${firstName}.`} style={{ padding: "10px 12px", resize: "vertical" }} />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" className="nv27-btn-primary" disabled={busy} onClick={send} style={{ flex: "0 0 auto", minHeight: 44, padding: "0 16px", border: 0, cursor: "pointer", font: "inherit", fontWeight: 600 }}>
          {busy ? "Envoi…" : "Envoyer la demande"}
        </button>
        <button type="button" className="nv27-btn-ghost" disabled={busy} onClick={() => setOpen(false)} style={{ flex: "0 0 auto", minHeight: 44, padding: "0 16px", borderWidth: 1, borderStyle: "solid", cursor: "pointer", font: "inherit" }}>
          Annuler
        </button>
      </div>
      {error ? <p role="alert" style={{ margin: 0, fontSize: "0.85rem", color: "var(--adm-bad)" }}>{error}</p> : null}
    </div>
  );
}

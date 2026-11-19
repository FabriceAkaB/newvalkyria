"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const post = async (body: Record<string, unknown>) => {
  const res = await fetch("/api/admin/coaching/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: !!res?.ok, json: res ? await res.json().catch(() => null) : null };
};

/** « Confirmer et envoyer » les invitations proposées pour une pratique. */
export function ConfirmInvitesButton({ slotId, date, count }: { slotId: string; date: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className="admin-btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await post({ action: "confirmer", slotId, date });
          setBusy(false);
          setMsg(r.ok ? `${r.json.sent.length} invitation${r.json.sent.length > 1 ? "s" : ""} envoyée${r.json.sent.length > 1 ? "s" : ""}${r.json.failed.length ? ` · pas envoyées : ${r.json.failed.join(", ")}` : ""}` : "Pas envoyé. Réessaie.");
          router.refresh();
        }}
      >
        {busy ? "Envoi…" : `Confirmer et envoyer ${count > 1 ? `les ${count} invitations` : "l'invitation"}`}
      </button>
      {msg && <span style={{ color: "var(--adm-text-2)", fontSize: "0.9rem" }}>{msg}</span>}
    </div>
  );
}

export function CancelInviteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="admin-btn-ghost" style={{ padding: "4px 10px", fontSize: "0.8rem" }} disabled={busy} onClick={async () => { setBusy(true); await post({ action: "retirer", id }); router.refresh(); }}>
      Retirer
    </button>
  );
}

export function ScanNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className="admin-btn-ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await post({ action: "lire" });
          setBusy(false);
          setMsg(r.ok ? (r.json.skipped ? r.json.skipped : `${r.json.proposed} proposée${r.json.proposed > 1 ? "s" : ""}, ${r.json.added} ajoutée${r.json.added > 1 ? "s" : ""} dans MonClubSportif${r.json.errors.length ? ` · ${r.json.errors.join(" ; ")}` : ""}`) : "La lecture n'a pas marché. Réessaie.");
          router.refresh();
        }}
      >
        {busy ? "Lecture de MonClubSportif…" : "Lire les absences maintenant"}
      </button>
      {msg && <span style={{ color: "var(--adm-text-2)", fontSize: "0.9rem" }}>{msg}</span>}
    </div>
  );
}

/** La liste des priorités d'un groupe avancé : JP épingle et ordonne ; les autres suivent les règles. */
export function PriorityList({ slotId, candidates }: { slotId: string; candidates: { registrationId: string; name: string; rank: number; reason: string; pinned: number | null; ownGroup: string }[] }) {
  const router = useRouter();
  const [pinned, setPinned] = useState<string[]>(candidates.filter((c) => c.pinned != null).sort((a, b) => (a.pinned ?? 0) - (b.pinned ?? 0)).map((c) => c.registrationId));
  const [busy, setBusy] = useState(false);
  const save = async (next: string[]) => {
    setPinned(next);
    setBusy(true);
    await post({ action: "priorite", slotId, pinned: next });
    setBusy(false);
    router.refresh();
  };
  const move = (id: string, d: -1 | 1) => {
    const i = pinned.indexOf(id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= pinned.length) return;
    const next = [...pinned];
    [next[i], next[j]] = [next[j], next[i]];
    void save(next);
  };
  if (!candidates.length) return <p style={{ margin: 0, padding: "14px 16px", color: "var(--adm-text-2)" }}>Aucune fille de l&apos;intermédiaire de cet âge pour l&apos;instant.</p>;
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {candidates.map((c) => {
        const isPinned = pinned.includes(c.registrationId);
        return (
          <li key={c.registrationId} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--adm-line)" }}>
            <span style={{ width: 24, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: isPinned ? "var(--adm-accent)" : "var(--adm-text-2)" }}>{c.rank}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>{c.name} <span style={{ fontWeight: 400, color: "var(--adm-text-2)", fontSize: "0.85rem" }}>· {c.ownGroup}</span></p>
              <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--adm-text-2)" }}>{c.reason}</p>
            </div>
            {isPinned ? (
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" className="admin-btn-ghost" style={{ padding: "4px 8px" }} disabled={busy} aria-label={`Monter ${c.name}`} onClick={() => move(c.registrationId, -1)}>↑</button>
                <button type="button" className="admin-btn-ghost" style={{ padding: "4px 8px" }} disabled={busy} aria-label={`Descendre ${c.name}`} onClick={() => move(c.registrationId, 1)}>↓</button>
                <button type="button" className="admin-btn-ghost" style={{ padding: "4px 10px", fontSize: "0.8rem" }} disabled={busy} onClick={() => save(pinned.filter((x) => x !== c.registrationId))}>Désépingler</button>
              </div>
            ) : (
              <button type="button" className="admin-btn-ghost" style={{ padding: "4px 10px", fontSize: "0.8rem" }} disabled={busy} onClick={() => save([...pinned, c.registrationId])}>Épingler</button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function InviteSettingsForm({ threshold, enabled }: { threshold: number; enabled: boolean }) {
  const router = useRouter();
  const [t, setT] = useState(threshold);
  const [on, setOn] = useState(enabled);
  const [saved, setSaved] = useState(false);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "14px 16px" }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--adm-text)" }}>
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setSaved(false); }} /> Proposer des invitations
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--adm-text)" }}>
        à partir de
        <input type="number" min={1} max={10} className="admin-input" style={{ width: 70 }} value={t} onChange={(e) => { setT(Number(e.target.value)); setSaved(false); }} />
        absentes
      </label>
      <button type="button" className="admin-btn-ghost" onClick={async () => { await post({ action: "reglages", settings: { threshold: t, enabled: on, horizonDays: 7 } }); setSaved(true); router.refresh(); }}>Enregistrer</button>
      {saved && <span style={{ color: "var(--adm-good)" }}>✓ Enregistré</span>}
    </div>
  );
}

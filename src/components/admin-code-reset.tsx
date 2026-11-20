"use client";

import { useState } from "react";

/** Choisir un nouveau code administrateur avec le lien reçu par courriel. */
export function AdminCodeResetForm({ token }: { token: string }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setState({ ok: false, msg: "Les deux codes ne sont pas pareils." });
    setBusy(true);
    const res = await fetch("/api/admin/code-oublie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, next }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    setState(res?.ok ? { ok: true, msg: "Ton nouveau code est enregistré. Connecte-toi avec lui." } : { ok: false, msg: json?.error ?? "Pas enregistré. Réessaie." });
  };
  if (state?.ok) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <p role="status" style={{ margin: 0, color: "var(--adm-good)", fontWeight: 600 }}>{state.msg}</p>
        <a href="/admin" className="admin-btn-primary" style={{ textDecoration: "none", textAlign: "center" }}>Me connecter</a>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="admin-login-form">
      <label className="admin-field">
        <span>Nouveau code (8 caractères ou plus)</span>
        <input className="admin-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required autoFocus />
      </label>
      <label className="admin-field">
        <span>Encore une fois</span>
        <input className="admin-input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </label>
      {state && <p className="admin-error" role="alert">{state.msg}</p>}
      <button type="submit" disabled={busy} className="admin-btn-primary">{busy ? "Enregistrement…" : "Enregistrer mon nouveau code"}</button>
    </form>
  );
}

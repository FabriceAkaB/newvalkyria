"use client";

import { useState } from "react";

const TARGETS = [
  { value: "admin", label: "Mon code administrateur (JP)" },
  { value: "gerante", label: "Code de la gérante" },
  { value: "borne", label: "Code de la borne (tablette du terrain)" }
] as const;

/** JP change un code d'accès en le tapant lui-même : le code actuel est demandé, rien n'est affiché. */
export function AccessCodeForm() {
  const [target, setTarget] = useState<string>("admin");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState(null);
    if (next !== confirm) return setState({ ok: false, msg: "Les deux nouveaux codes ne sont pas pareils." });
    setBusy(true);
    const res = await fetch("/api/admin/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, current, next }) }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setBusy(false);
    if (res?.ok) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setState({ ok: true, msg: target === "admin" ? "Ton code administrateur est changé. Utilise-le à ta prochaine connexion." : "Le code est changé." });
    } else setState({ ok: false, msg: json?.error ?? "Pas changé. Réessaie." });
  };
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, padding: "16px 20px", maxWidth: 440 }}>
      <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        Code à changer
        <select className="admin-input" value={target} onChange={(e) => setTarget(e.target.value)}>
          {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        Ton code administrateur actuel
        <input className="admin-input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        Nouveau code {target === "borne" ? "(6 caractères ou plus)" : "(8 caractères ou plus)"}
        <input className="admin-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
      </label>
      <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        Nouveau code, encore une fois
        <input className="admin-input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </label>
      <button type="submit" className="admin-btn-primary" disabled={busy} style={{ justifySelf: "start" }}>{busy ? "Enregistrement…" : "Changer le code"}</button>
      {state && <p role={state.ok ? "status" : "alert"} style={{ margin: 0, color: state.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{state.msg}</p>}
    </form>
  );
}

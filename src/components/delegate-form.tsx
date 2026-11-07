"use client";

import { useEffect, useState } from "react";

interface Assignee {
  name: string;
  email: string | null;
  role: string;
}

let cache: Assignee[] | null = null;

/** « Confier à… » : choisir une personne (direction, éducateurs ou autre), une date et une consigne ; la personne
 *  reçoit un courriel avec son lien. Sert dans le Mandalart et dans « Ma journée ». */
export function DelegateForm({
  mandalartCode,
  defaultTitle = "",
  defaultDue = null,
  withTitle = false,
  onDone,
  onCancel
}: {
  mandalartCode?: string | null;
  defaultTitle?: string;
  defaultDue?: string | null;
  /** Montrer le champ « tâche » (faux pour une tâche du Mandalart : son titre est repris). */
  withTitle?: boolean;
  onDone: (who: string) => void;
  onCancel?: () => void;
}) {
  const [people, setPeople] = useState<Assignee[]>(cache ?? []);
  const [who, setWho] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherEmail, setOtherEmail] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [details, setDetails] = useState("");
  const [due, setDue] = useState(defaultDue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    fetch("/api/admin/moi")
      .then((r) => r.json())
      .then((d: { assignees?: Assignee[] }) => {
        cache = d.assignees ?? [];
        setPeople(cache);
      })
      .catch(() => setPeople([]));
  }, []);

  const person = people.find((p) => p.name === who);
  const isOther = who === "__autre";
  const name = isOther ? otherName.trim() : who;
  const email = isOther ? otherEmail.trim() : person?.email ?? (otherEmail.trim() || null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!name) throw new Error("Choisis à qui confier la tâche");
      const res = await fetch("/api/admin/moi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", title, details: details || null, due: due || null, assignee: name, assigneeEmail: email || null, mandalartCode: mandalartCode ?? null })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Erreur");
      onDone(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mda-task-edit" style={{ display: "grid", gap: 8 }}>
      <select className="admin-input" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Confier à">
        <option value="">Confier à…</option>
        {people.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name} · {p.role}
            {p.email ? "" : " (sans courriel)"}
          </option>
        ))}
        <option value="__autre">Quelqu&apos;un d&apos;autre…</option>
      </select>
      {isOther ? (
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <input className="admin-input" placeholder="Nom" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
          <input className="admin-input" placeholder="Courriel" type="email" value={otherEmail} onChange={(e) => setOtherEmail(e.target.value)} />
        </div>
      ) : person && !person.email ? (
        <input className="admin-input" placeholder={`Courriel de ${person.name}`} type="email" value={otherEmail} onChange={(e) => setOtherEmail(e.target.value)} />
      ) : null}
      {withTitle ? <input className="admin-input" placeholder="La tâche" value={title} onChange={(e) => setTitle(e.target.value)} /> : null}
      <textarea className="admin-input" rows={2} placeholder="Consigne : ce que tu attends, où trouver l'info (facultatif)" value={details} onChange={(e) => setDetails(e.target.value)} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
        Pour le
        <input className="admin-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ maxWidth: 180 }} />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="admin-btn-primary" disabled={busy || !name} onClick={submit}>
          {busy ? "Envoi…" : name ? `Confier à ${name.split(" ")[0]} (courriel)` : "Confier"}
        </button>
        {onCancel ? (
          <button type="button" className="admin-btn-ghost" disabled={busy} onClick={onCancel}>
            Annuler
          </button>
        ) : null}
      </div>
      {error ? <p style={{ fontSize: "0.8rem", color: "var(--adm-bad)", margin: 0 }}>{error}</p> : null}
    </div>
  );
}

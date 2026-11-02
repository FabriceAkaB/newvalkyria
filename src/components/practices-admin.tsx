"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function create(body: Record<string, unknown>): Promise<string> {
  const res = await fetch("/api/admin/pratiques", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json.id;
}

/** « Préparer » : crée l'activité de la pratique (si elle n'existe pas) puis ouvre son plan de séance. */
export function PrepareButton({ practice, label = "Préparer" }: { practice: { date: string; start: string; end: string | null; location: string; group: string; organization?: string | null }; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="admin-btn-primary"
      style={{ padding: "6px 12px", whiteSpace: "nowrap" }}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const id = await create(practice);
          router.push(`/admin/entraineurs/activites/${id}`);
        } catch (err) {
          alert(err instanceof Error ? err.message : "Erreur");
          setBusy(false);
        }
      }}
    >
      {busy ? "…" : label}
    </button>
  );
}

const ORGS = ["CF Montréal", "St-Gabriel"];

/** Ajouter une pratique que JP donne hors de l'Académie. */
export function ExternalPracticeForm() {
  const router = useRouter();
  const [f, setF] = useState({ organization: ORGS[0], other: "", date: "", start: "", end: "", group: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      style={{ display: "grid", gap: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          const org = f.organization === "Autre" ? f.other.trim() : f.organization;
          const id = await create({ date: f.date, start: f.start, end: f.end || null, location: f.location, group: f.group || `Pratique ${org}`, organization: org });
          router.push(`/admin/entraineurs/activites/${id}`);
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Erreur");
          setBusy(false);
        }
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="admin-input" style={{ width: "auto" }} value={f.organization} onChange={set("organization")}>
          {[...ORGS, "Autre"].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {f.organization === "Autre" ? <input className="admin-input" style={{ flex: "1 1 160px" }} placeholder="Organisation" value={f.other} onChange={set("other")} required /> : null}
        <input className="admin-input" style={{ flex: "1 1 200px" }} placeholder="Groupe (ex. U12 féminin AAA)" value={f.group} onChange={set("group")} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="admin-input" style={{ width: "auto" }} type="date" value={f.date} onChange={set("date")} required aria-label="Date" />
        <input className="admin-input" style={{ width: "auto" }} type="time" value={f.start} onChange={set("start")} required aria-label="Début" />
        <input className="admin-input" style={{ width: "auto" }} type="time" value={f.end} onChange={set("end")} aria-label="Fin" />
        <input className="admin-input" style={{ flex: "1 1 220px" }} placeholder="Lieu" value={f.location} onChange={set("location")} />
      </div>
      <div>
        <button className="admin-btn-primary" disabled={busy}>Ajouter et préparer le plan</button>
      </div>
      {msg ? <p style={{ fontSize: "0.8rem", color: "var(--adm-bad)", margin: 0 }}>{msg}</p> : null}
    </form>
  );
}

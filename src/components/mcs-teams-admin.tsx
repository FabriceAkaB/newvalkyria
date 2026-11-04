"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { McsTeam } from "@/lib/mcs-teams-repo";

async function post(body: unknown): Promise<{ ok: boolean; error?: string; data?: any }> {
  const res = await fetch("/api/admin/monclubsportif/equipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = await res?.json().catch(() => ({}));
  if (!res?.ok) return { ok: false, error: data?.error ?? "Pas enregistré : réessaie." };
  if (data?.sync && data.sync.ok === false) return { ok: false, error: `Équipe enregistrée, mais le calendrier n'a pas pu être lu : ${data.sync.error}` };
  if (data?.ok === false) return { ok: false, error: data.error };
  return { ok: true, data };
}

/** Ajouter une équipe MonClubSportif : son nom, ses années de naissance et son lien « Sync » (une fois). */
export function McsTeamForm({ team, onDone }: { team?: McsTeam; onDone?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(team?.name ?? "");
  const [years, setYears] = useState(team?.birth_years.join(", ") ?? "");
  const [gender, setGender] = useState(team?.gender ?? "filles");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "error"; message?: string }>({ kind: "idle" });
  const save = async () => {
    setState({ kind: "saving" });
    const r = await post({ id: team?.id, name, years, gender, ...(url.trim() ? { icalUrl: url.trim() } : {}) });
    if (!r.ok) return setState({ kind: "error", message: r.error });
    setState({ kind: "idle" });
    setUrl("");
    if (!team) {
      setName("");
      setYears("");
    }
    onDone?.();
    router.refresh();
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <label className="ct-field"><span>Nom dans MonClubSportif</span><input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Valkyria 2016" /></label>
        <label className="ct-field"><span>Années de naissance</span><input className="admin-input" value={years} onChange={(e) => setYears(e.target.value)} placeholder="Ex. 2016 ou 2013-2014" /></label>
        <label className="ct-field">
          <span>Équipe</span>
          <select className="admin-input" value={gender} onChange={(e) => setGender(e.target.value as McsTeam["gender"])}>
            <option value="filles">Filles</option>
            <option value="garcons">Garçons</option>
            <option value="mixte">Mixte</option>
          </select>
        </label>
      </div>
      <label className="ct-field">
        <span>{team?.urlMasked ? `Lien « Sync » (actuel : ${team.urlMasked}) — laisser vide pour le garder` : "Lien « Sync » du calendrier de l'équipe (MonClubSportif → Calendrier → Sync)"}</span>
        <input className="admin-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="webcal://… ou https://…" />
      </label>
      <div className="cm-actions" style={{ marginTop: 0 }}>
        <button type="button" className="admin-btn-primary" onClick={save} disabled={!name.trim() || state.kind === "saving"} style={{ minHeight: 44 }}>
          {state.kind === "saving" ? "Lecture du calendrier…" : team ? "Enregistrer" : "Ajouter l'équipe"}
        </button>
        {state.kind === "error" && <span role="alert" style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }}>{state.message}</span>}
      </div>
    </div>
  );
}

export function McsTeamActions({ team }: { team: McsTeam }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (action: "sync" | "delete") => {
    if (action === "delete" && !confirm(`Retirer l'équipe « ${team.name} » du site ? (rien n'est touché dans MonClubSportif)`)) return;
    setBusy(true);
    const r = await post({ action, id: team.id });
    setBusy(false);
    setMsg(r.ok ? null : r.error ?? null);
    router.refresh();
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="admin-btn-ghost" disabled={busy || !team.urlMasked} onClick={() => run("sync")}>{busy ? "Lecture…" : "Relire maintenant"}</button>
        <button type="button" className="admin-btn-ghost" onClick={() => setEdit(!edit)}>{edit ? "Fermer" : "Modifier"}</button>
        <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => run("delete")}>Retirer</button>
      </div>
      {msg && <span role="alert" style={{ color: "var(--adm-bad)", fontSize: "0.82rem" }}>{msg}</span>}
      {edit && <McsTeamForm team={team} onDone={() => setEdit(false)} />}
    </div>
  );
}

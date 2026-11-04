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

/** Le compte robot MonClubSportif, tapé par JP lui-même : chiffré dans la base, jamais réaffiché ni envoyé à Claude. */
export function McsRobotForm({ status }: { status: { email: string; updatedAt: string | null } | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const save = async () => {
    setState({ kind: "saving" });
    const res = await fetch("/api/admin/monclubsportif/robot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setPassword("");
    if (!res?.ok) return setState({ kind: "error", message: data?.error ?? "Pas enregistré : réessaie." });
    setState({ kind: "saved" });
    setEmail("");
    router.refresh();
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p className="mda-sub" style={{ margin: 0 }}>
        {status ? `Compte robot enregistré : ${status.email}. Pour le changer, retape le courriel et le mot de passe.` : "Aucun compte robot pour l'instant."} Le mot de passe est chiffré dans la base : il n&apos;est jamais réaffiché, ni montré à Claude.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        style={{ display: "grid", gap: 8 }}
        autoComplete="off"
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
          <label className="ct-field"><span>Courriel du compte robot</span><input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></label>
          <label className="ct-field"><span>Mot de passe</span><input className="admin-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></label>
        </div>
        <div className="cm-actions" style={{ marginTop: 0 }}>
          <button type="submit" className="admin-btn-primary" disabled={!email || !password || state.kind === "saving"} style={{ minHeight: 44 }}>{state.kind === "saving" ? "Enregistrement…" : "Enregistrer le compte robot"}</button>
          {state.kind === "saved" && <span style={{ color: "var(--adm-good)", fontSize: "0.85rem" }}>Enregistré et chiffré.</span>}
          {state.kind === "error" && <span role="alert" style={{ color: "var(--adm-bad)", fontSize: "0.85rem" }}>{state.message}</span>}
        </div>
      </form>
    </div>
  );
}

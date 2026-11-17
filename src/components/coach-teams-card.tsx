"use client";

import { useEffect, useState } from "react";

import { LEADERSHIP_SCALE, type TeamKind } from "@/lib/practice-teams-core";

/** Portail : équipes et duos nouveaux à chaque pratique (le site se souvient de qui était avec qui), une capitaine
 *  par équipe (chacune à son tour) avec sa tâche selon le thème, puis la note de son leadership. */

interface Player {
  registrationId: string;
  firstName: string;
  lastName: string;
}
interface Draft {
  label: string;
  members: string[];
  captain: string | null;
  captainTask: string | null;
}
interface Saved extends Draft {
  id: string;
  kind: TeamKind;
  leadership: number | null;
  leadership_note: string | null;
}

export function CoachTeamsCard({ activityId, players, theme }: { activityId: string; players: Player[]; theme: string | null }) {
  const [kind, setKind] = useState<TeamKind>("equipe");
  const [count, setCount] = useState(2);
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (id: string) => {
    const p = players.find((x) => x.registrationId === id);
    return p ? `${p.firstName} ${p.lastName.charAt(0)}.` : "?";
  };

  useEffect(() => {
    fetch(`/api/coach/activities/${activityId}/equipes`)
      .then((r) => r.json())
      .then((d) =>
        setSaved(((d?.teams ?? []) as any[]).map((t) => ({ id: t.id, kind: t.kind, label: t.label, members: t.members, captain: t.captain_registration_id, captainTask: t.captain_task, leadership: t.leadership, leadership_note: t.leadership_note })))
      )
      .catch(() => null);
  }, [activityId]);

  const call = async (method: string, body: unknown) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/coach/activities/${activityId}/equipes`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(data?.error ?? "Ça n'a pas fonctionné. Réessaie.");
      return null;
    }
    return data;
  };

  const propose = async () => {
    const data = await call("POST", { action: "proposer", kind, count, theme, players: players.map((p) => p.registrationId), seed: Date.now() });
    if (data?.proposal) setDraft(data.proposal);
  };
  const save = async () => {
    if (!draft) return;
    const data = await call("POST", { action: "enregistrer", kind, teams: draft });
    if (data?.teams) {
      setSaved((data.teams as any[]).map((t) => ({ id: t.id, kind: t.kind, label: t.label, members: t.members, captain: t.captain_registration_id, captainTask: t.captain_task, leadership: t.leadership, leadership_note: t.leadership_note })));
      setDraft(null);
    }
  };
  const rate = async (t: Saved, leadership: number | null, note: string | null) => {
    setSaved((s) => s.map((x) => (x.id === t.id ? { ...x, leadership, leadership_note: note } : x)));
    await call("PATCH", { teamId: t.id, leadership, note });
  };

  const savedOfKind = saved.filter((t) => t.kind === kind);
  const chip = (on: boolean): React.CSSProperties => ({ padding: "8px 12px", borderRadius: 999, border: "1px solid var(--adm-border)", background: on ? "var(--adm-accent-soft)" : "transparent", color: on ? "var(--adm-text)" : "var(--adm-text-2)", fontWeight: on ? 600 : 400, cursor: "pointer", minHeight: 36 });

  return (
    <div className="coach-card" style={{ marginTop: 12 }}>
      <p className="coach-card__label">Équipes, duos et capitaines</p>
      <p className="coach-sub" style={{ marginTop: 0 }}>
        Le site se souvient de qui était ensemble : il propose des équipes et des duos nouveaux, et une capitaine qui ne l&apos;a pas encore été.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <button type="button" style={chip(kind === "equipe")} onClick={() => (setKind("equipe"), setDraft(null))}>Équipes</button>
        <button type="button" style={chip(kind === "duo")} onClick={() => (setKind("duo"), setDraft(null))}>Duos (ateliers)</button>
        {kind === "equipe"
          ? [2, 3, 4].map((n) => (
              <button key={n} type="button" style={chip(count === n)} onClick={() => setCount(n)}>
                {n} équipes
              </button>
            ))
          : null}
      </div>
      <p className="coach-muted" style={{ margin: "0 0 8px" }}>{players.length} joueuse{players.length > 1 ? "s" : ""} présente{players.length > 1 ? "s" : ""}</p>
      <button type="button" className="coach-secondary" style={{ width: "100%" }} onClick={propose} disabled={busy || players.length < 2}>
        {draft ? "Mélanger encore" : kind === "duo" ? "Former des duos nouveaux" : "Former des équipes nouvelles"}
      </button>
      {error ? <p className="coach-error" role="alert">{error}</p> : null}

      {draft ? (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {draft.map((t, i) => (
            <div key={i} className="coach-block" style={{ margin: 0 }}>
              <p className="coach-block__title" style={{ marginBottom: 6 }}>{t.label}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {t.members.map((m) => (
                  <button
                    key={m}
                    type="button"
                    title={kind === "equipe" ? "Toucher pour nommer capitaine" : undefined}
                    onClick={() => kind === "equipe" && setDraft((d) => d!.map((x, j) => (j === i ? { ...x, captain: m } : x)))}
                    style={chip(t.captain === m)}
                  >
                    {t.captain === m ? "★ " : ""}
                    {name(m)}
                  </button>
                ))}
              </div>
              {kind === "equipe" ? (
                <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
                  <span className="coach-muted">Tâche de communication de la capitaine ({theme ? `thème : ${theme}` : "tâche de base"}) · brassard · pouvoir : 1 temps mort pour ajuster son équipe</span>
                  <textarea className="admin-input" rows={2} value={t.captainTask ?? ""} onChange={(e) => setDraft((d) => d!.map((x, j) => (j === i ? { ...x, captainTask: e.target.value } : x)))} />
                </label>
              ) : null}
            </div>
          ))}
          <button type="button" className="coach-primary" onClick={save} disabled={busy}>
            {busy ? "Enregistrement…" : kind === "duo" ? "Garder ces duos" : "Garder ces équipes"}
          </button>
        </div>
      ) : null}

      {!draft && savedOfKind.length ? (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {savedOfKind.map((t) => (
            <div key={t.id} className="coach-block" style={{ margin: 0 }}>
              <p className="coach-block__title" style={{ marginBottom: 4 }}>{t.label}</p>
              <p style={{ margin: 0, color: "var(--adm-text-2)" }}>
                {t.members.map((m) => `${m === t.captain ? "★ " : ""}${name(m)}`).join(" · ")}
              </p>
              {t.kind === "equipe" && t.captain ? (
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {t.captainTask ? <p className="coach-sub" style={{ margin: 0 }}>Tâche de {name(t.captain)} : {t.captainTask}</p> : null}
                  <span className="coach-muted">Leadership de {name(t.captain)} (après la pratique)</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" title={LEADERSHIP_SCALE[n]} style={chip(t.leadership === n)} onClick={() => rate(t, t.leadership === n ? null : n, t.leadership_note)}>
                        {n}
                      </button>
                    ))}
                  </div>
                  {t.leadership ? <span className="coach-muted">{LEADERSHIP_SCALE[t.leadership]}</span> : null}
                  <input
                    className="admin-input"
                    placeholder="Un mot sur son leadership (facultatif)"
                    defaultValue={t.leadership_note ?? ""}
                    onBlur={(e) => e.target.value !== (t.leadership_note ?? "") && rate(t, t.leadership, e.target.value || null)}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

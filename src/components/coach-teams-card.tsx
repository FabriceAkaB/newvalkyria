"use client";

import { useEffect, useState } from "react";

import { colorHex, LEADERSHIP_SCALE, matchups, TEAM_COLORS, type TeamKind } from "@/lib/practice-teams-core";

/** Portail : équipes et duos nouveaux à chaque pratique (le site se souvient de qui était avec qui), une capitaine
 *  par équipe (chacune à son tour) avec sa tâche selon le thème, puis la note de son leadership.
 *  JP, 20 nov. 2026 : le site prépare les équipes d'avance (on sait qui affronte qui) ; dans le rapport, on choisit
 *  la couleur de chaque équipe et qui était avec qui, pour que les prochaines équipes changent. */

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
  color: string | null;
}
interface Saved extends Draft {
  id: string;
  kind: TeamKind;
  planned: boolean;
  leadership: number | null;
  leadership_note: string | null;
}

const toSaved = (t: any): Saved => ({ id: t.id, kind: t.kind, label: t.label, members: t.members ?? [], captain: t.captain_registration_id, captainTask: t.captain_task, color: t.color ?? null, planned: Boolean(t.planned), leadership: t.leadership, leadership_note: t.leadership_note });

function Dot({ color }: { color: string | null }) {
  const hex = colorHex(color);
  if (!hex) return null;
  return <span aria-hidden style={{ width: 14, height: 14, borderRadius: 999, background: hex, border: "1px solid var(--adm-border)", display: "inline-block", flex: "0 0 auto" }} />;
}

/** Qui affronte qui : chaque équipe rencontre chaque autre une fois. */
function Matchups({ labels }: { labels: string[] }) {
  const rounds = matchups(labels);
  if (!rounds.length) return null;
  return (
    <div className="coach-block" style={{ margin: 0 }}>
      <p className="coach-block__title" style={{ marginBottom: 6 }}>Qui affronte qui</p>
      <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, color: "var(--adm-text)" }}>
        {rounds.map((r, i) => (
          <li key={i}>
            {r.games.map(([a, b]) => `${a} contre ${b}`).join(" · ")}
            {r.rest ? <span className="coach-muted"> · au repos : {r.rest}</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CoachTeamsCard({ activityId, players, theme, title }: { activityId: string; players: Player[]; theme: string | null; title?: string }) {
  const [kind, setKind] = useState<TeamKind>("equipe");
  const [count, setCount] = useState(2);
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const known = new Set(players.map((p) => p.registrationId));
  const name = (id: string) => {
    const p = players.find((x) => x.registrationId === id);
    return p ? `${p.firstName} ${p.lastName.charAt(0)}.` : "?";
  };

  useEffect(() => {
    fetch(`/api/coach/activities/${activityId}/equipes`)
      .then((r) => r.json())
      .then((d) => setSaved(((d?.teams ?? []) as any[]).map(toSaved)))
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
    if (data?.proposal) setDraft((data.proposal as any[]).map((t) => ({ ...t, color: kind === "equipe" ? t.label : null })));
  };
  const save = async () => {
    if (!draft) return;
    const data = await call("POST", { action: "enregistrer", kind, teams: draft });
    if (data?.teams) {
      setSaved((data.teams as any[]).map(toSaved));
      setDraft(null);
    }
  };
  const confirm = async () => {
    const data = await call("POST", { action: "confirmer", kind });
    if (data?.teams) setSaved((data.teams as any[]).map(toSaved));
  };
  const rate = async (t: Saved, leadership: number | null, note: string | null) => {
    setSaved((s) => s.map((x) => (x.id === t.id ? { ...x, leadership, leadership_note: note } : x)));
    await call("PATCH", { teamId: t.id, leadership, note });
  };

  const savedOfKind = saved.filter((t) => t.kind === kind);
  const planned = savedOfKind.length > 0 && savedOfKind.every((t) => t.planned);
  const chip = (on: boolean): React.CSSProperties => ({ padding: "8px 12px", borderRadius: 999, border: "1px solid var(--adm-border)", background: on ? "var(--adm-accent-soft)" : "transparent", color: on ? "var(--adm-text)" : "var(--adm-text-2)", fontWeight: on ? 600 : 400, cursor: "pointer", minHeight: 36, display: "inline-flex", alignItems: "center", gap: 6 });

  /** Modifier les équipes enregistrées : les absentes sortent, les filles sans équipe restent à placer. */
  const edit = () => setDraft(savedOfKind.map((t) => ({ label: t.label, members: t.members.filter((m) => known.has(m)), captain: t.captain && known.has(t.captain) ? t.captain : null, captainTask: t.captainTask, color: t.color ?? (kind === "equipe" ? t.label : null) })));
  const teamOf = (id: string) => draft?.findIndex((t) => t.members.includes(id)) ?? -1;
  const place = (id: string, i: number) =>
    setDraft((d) => d!.map((t, j) => ({ ...t, members: j === i ? (t.members.includes(id) ? t.members : [...t.members, id]) : t.members.filter((m) => m !== id), captain: j !== i && t.captain === id ? null : t.captain })));
  const setColor = (i: number, color: string) => setDraft((d) => d!.map((t, j) => (j === i ? { ...t, color, label: color } : t)));
  const addTeam = () =>
    setDraft((d) => {
      const used = new Set(d!.map((t) => t.color));
      const color = TEAM_COLORS.find((c) => !used.has(c.name))?.name ?? `Équipe ${d!.length + 1}`;
      return [...d!, { label: color, members: [], captain: null, captainTask: d![0]?.captainTask ?? null, color }];
    });
  const removeTeam = (i: number) => setDraft((d) => d!.filter((_, j) => j !== i));

  return (
    <div className="coach-card" style={{ marginTop: 12 }}>
      <p className="coach-card__label">{title ?? "Équipes, duos et capitaines"}</p>
      <p className="coach-sub" style={{ marginTop: 0 }}>
        Le site se souvient de qui était ensemble : il prépare d&apos;avance des équipes nouvelles, une capitaine qui ne l&apos;a pas encore été, et qui affronte qui. Après la pratique, note la couleur de chaque équipe et qui était avec qui.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <button type="button" style={chip(kind === "equipe")} onClick={() => (setKind("equipe"), setDraft(null))}>Équipes</button>
        <button type="button" style={chip(kind === "duo")} onClick={() => (setKind("duo"), setDraft(null))}>Duos (ateliers)</button>
        {kind === "equipe" && !draft && !savedOfKind.length
          ? [2, 3, 4].map((n) => (
              <button key={n} type="button" style={chip(count === n)} onClick={() => setCount(n)}>
                {n} équipes
              </button>
            ))
          : null}
      </div>
      {!draft ? (
        <>
          <p className="coach-muted" style={{ margin: "0 0 8px" }}>{players.length} joueuse{players.length > 1 ? "s" : ""}</p>
          <button type="button" className="coach-secondary" style={{ width: "100%" }} onClick={propose} disabled={busy || players.length < 2}>
            {savedOfKind.length ? "Refaire des équipes nouvelles" : kind === "duo" ? "Former des duos nouveaux" : "Former des équipes nouvelles"}
          </button>
        </>
      ) : null}
      {error ? <p className="coach-error" role="alert">{error}</p> : null}

      {draft ? (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {draft.map((t, i) => (
            <div key={i} className="coach-block" style={{ margin: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                {kind === "equipe" ? (
                  <>
                    <Dot color={t.color} />
                    <select className="admin-input" style={{ width: "auto", minHeight: 36 }} value={t.color ?? ""} onChange={(e) => setColor(i, e.target.value)} aria-label={`Couleur de l'équipe ${i + 1}`}>
                      {TEAM_COLORS.map((c) => (
                        <option key={c.name} value={c.name} disabled={draft.some((x, j) => j !== i && x.color === c.name)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <span className="coach-muted">{t.members.length} joueuse{t.members.length > 1 ? "s" : ""}</span>
                    {draft.length > 2 ? (
                      <button type="button" className="coach-secondary" style={{ marginLeft: "auto", minHeight: 32, padding: "0 10px" }} onClick={() => removeTeam(i)}>
                        Retirer
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="coach-block__title" style={{ margin: 0 }}>{t.label}</p>
                )}
              </div>
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
                  <span className="coach-muted">Tâche de la capitaine ({theme ? `thème : ${theme}` : "tâche de base"}) · touche une joueuse pour la nommer capitaine</span>
                  <textarea className="admin-input" rows={2} value={t.captainTask ?? ""} onChange={(e) => setDraft((d) => d!.map((x, j) => (j === i ? { ...x, captainTask: e.target.value } : x)))} />
                </label>
              ) : null}
            </div>
          ))}

          {kind === "equipe" ? (
            <div className="coach-block" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <p className="coach-block__title" style={{ margin: 0 }}>Qui était avec qui</p>
                {draft.length < 6 ? (
                  <button type="button" className="coach-secondary" style={{ minHeight: 32, padding: "0 10px" }} onClick={addTeam}>
                    + Une équipe
                  </button>
                ) : null}
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
                {players.map((p) => {
                  const at = teamOf(p.registrationId);
                  return (
                    <li key={p.registrationId} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                      <span style={{ minWidth: 110, fontWeight: 600, color: at < 0 ? "var(--adm-warn)" : "var(--adm-text)" }}>
                        {name(p.registrationId)}
                        {at < 0 ? <small style={{ display: "block", fontWeight: 400 }}>Sans équipe</small> : null}
                      </span>
                      {draft.map((t, i) => (
                        <button key={i} type="button" aria-pressed={at === i} onClick={() => place(p.registrationId, i)} style={{ ...chip(at === i), padding: "6px 10px", minHeight: 32 }}>
                          <Dot color={t.color} />
                          {t.label}
                        </button>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {kind === "equipe" ? <Matchups labels={draft.filter((t) => t.members.length).map((t) => t.label)} /> : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="coach-primary" style={{ flex: 1 }} onClick={save} disabled={busy}>
              {busy ? "Enregistrement…" : kind === "duo" ? "Garder ces duos" : "Enregistrer les équipes"}
            </button>
            <button type="button" className="coach-secondary" onClick={() => setDraft(null)} disabled={busy}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {!draft && savedOfKind.length ? (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {planned ? (
            <div className="coach-block" style={{ margin: 0, background: "var(--adm-accent-soft)" }}>
              <p style={{ margin: 0, color: "var(--adm-text)", fontWeight: 600 }}>Équipes préparées d&apos;avance par le site</p>
              <p className="coach-muted" style={{ margin: "4px 0 8px" }}>Des filles qui n&apos;ont pas souvent joué ensemble, et une capitaine qui ne l&apos;a pas été récemment. Après la pratique, confirme-les ou corrige qui était avec qui.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="coach-primary" style={{ marginTop: 0, width: "auto" }} onClick={confirm} disabled={busy}>C&apos;est ce qu&apos;on a joué</button>
                <button type="button" className="coach-secondary" onClick={edit} disabled={busy}>Modifier (couleurs, qui était avec qui)</button>
              </div>
            </div>
          ) : (
            <button type="button" className="coach-secondary" onClick={edit} disabled={busy}>
              Modifier (couleurs, qui était avec qui)
            </button>
          )}
          {savedOfKind.map((t) => (
            <div key={t.id} className="coach-block" style={{ margin: 0 }}>
              <p className="coach-block__title" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <Dot color={t.color} />
                {t.label}
              </p>
              <p style={{ margin: 0, color: "var(--adm-text-2)" }}>
                {t.members.filter((m) => known.has(m)).map((m) => `${m === t.captain ? "★ " : ""}${name(m)}`).join(" · ")}
              </p>
              {t.kind === "equipe" && t.captain && known.has(t.captain) ? (
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
          {kind === "equipe" ? <Matchups labels={savedOfKind.map((t) => t.label)} /> : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, RefreshCw, Shuffle, Timer, Trophy, UserPlus } from "lucide-react";

import { colorHex } from "@/lib/practice-teams-core";
import {
  buildSchedule,
  champion,
  defaultFields,
  finishFor,
  FINISHES,
  formatLabel,
  formTournamentTeams,
  outcome,
  poolDone,
  resolveSlot,
  standings,
  teamPlan,
  teamStrength,
  TOURNAMENT_COLORS,
  TOURNAMENT_FORMATS,
  type MatchResult,
  type Results,
  type ScheduledMatch,
  type TournamentFinish,
  type TournamentFormat,
  type TournamentSettings,
  type TournamentTeam
} from "@/lib/practice-tournament";
import type { TournamentContext, TournamentState } from "@/lib/practice-tournament-repo";

/** Tournoi de fin de pratique (JP, 26 nov. 2026), le même sur la borne (code 180180), dans le portail des
 *  éducateurs et dans l'admin : qui est là, le format, la durée ; le site forme les équipes (nouvelles, forces
 *  équilibrées, joker), donne qui contre qui et pendant combien de temps, puis le classement en direct et la finale.
 *  Tout reste sur l'appareil : sans réseau, le tournoi continue et s'enregistre au retour du réseau. */

const CSS = `
.tn { --t-text: var(--adm-text, #1d1730); --t-text-2: var(--adm-text-2, #4a4358); --t-text-3: var(--adm-text-3, #6b6478);
  --t-surface: var(--adm-surface, #fff); --t-surface-2: var(--adm-surface-2, #f4f0f8); --t-line: var(--adm-line, #ece6f3);
  --t-border: var(--adm-border, #e0d8ea); --t-accent: var(--adm-accent, #5b2a86); --t-on-accent: var(--adm-on-accent, #fff);
  --t-accent-soft: var(--adm-accent-soft, #efe7fa); --t-good: var(--adm-good, #1f7a4d); --t-good-soft: var(--adm-good-soft, #e8f5ee);
  --t-bad: var(--adm-bad, #b3261e); --t-warn: var(--adm-warn, #8a5a00); --t-warn-soft: var(--adm-warn-soft, #fff4e0);
  display: grid; gap: 14px; color: var(--t-text); font-variant-numeric: tabular-nums; }
.tn-card { background: var(--t-surface); border: 1px solid var(--t-border); border-radius: 14px; padding: 18px 20px; display: grid; gap: 12px; }
.tn-h { margin: 0; font-size: 1.15rem; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.tn-sub { margin: 0; color: var(--t-text-2); font-size: 0.9rem; }
.tn-label { margin: 0; font-size: 0.8rem; font-weight: 600; color: var(--t-text-3); }
.tn-seg { display: flex; flex-wrap: wrap; gap: 6px; }
.tn-seg button, .tn-chip { min-height: 44px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--t-border); background: var(--t-surface); color: var(--t-text); font: inherit; font-weight: 600; cursor: pointer; }
.tn-seg button[aria-pressed="true"], .tn-chip[aria-pressed="true"] { background: var(--t-accent); border-color: var(--t-accent); color: var(--t-on-accent); }
.tn-chip { min-height: 40px; padding: 0 12px; font-weight: 500; }
.tn-chip[aria-pressed="false"] { color: var(--t-text-3); text-decoration: line-through; background: var(--t-surface-2); }
.tn-primary { min-height: 48px; border-radius: 12px; border: none; background: var(--t-accent); color: var(--t-on-accent); font: inherit; font-weight: 700; font-size: 1.02rem; cursor: pointer; padding: 0 18px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.tn-primary:disabled { opacity: 0.5; cursor: default; }
.tn-ghost { min-height: 40px; border-radius: 10px; border: 1px solid var(--t-border); background: var(--t-surface); color: var(--t-text); font: inherit; font-weight: 600; cursor: pointer; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; }
.tn-ghost.danger { color: var(--t-bad); }
.tn-dot { width: 14px; height: 14px; border-radius: 999px; border: 1px solid var(--t-border); display: inline-block; flex: 0 0 auto; }
.tn-teams { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
.tn-team { border: 1px solid var(--t-border); border-radius: 12px; padding: 12px 14px; display: grid; gap: 6px; align-content: start; background: var(--t-surface); }
.tn-team ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
.tn-member { display: flex; align-items: center; gap: 6px; min-height: 32px; border-radius: 8px; padding: 0 6px; margin: 0 -6px; border: none; background: none; font: inherit; color: inherit; text-align: left; width: calc(100% + 12px); }
button.tn-member { cursor: pointer; }
.tn-member[data-picked="true"] { background: var(--t-accent-soft); outline: 2px solid var(--t-accent); }
.tn-pill { font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--t-accent-soft); color: var(--t-accent); white-space: nowrap; }
.tn-wave { display: grid; gap: 8px; }
.tn-wave-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.tn-match { border: 1px solid var(--t-border); border-radius: 12px; padding: 10px; display: grid; gap: 8px; }
.tn-row { display: grid; grid-template-columns: minmax(0, 1fr) 64px auto 64px minmax(0, 1fr); gap: 6px; align-items: center; }
.tn-team-btn { min-height: 48px; border-radius: 10px; border: 1px solid var(--t-border); background: var(--t-surface); color: var(--t-text); font: inherit; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; min-width: 0; }
.tn-team-btn span.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tn-team-btn[data-win="true"] { background: var(--t-good-soft); border-color: var(--t-good); color: var(--t-good); }
.tn-team-btn:disabled { cursor: default; opacity: 0.6; }
.tn-score { width: 100%; min-height: 48px; border-radius: 10px; border: 1px solid var(--t-border); background: var(--t-surface); color: var(--t-text); font: inherit; font-size: 1.15rem; font-weight: 700; text-align: center; }
.tn-nul { min-height: 36px; justify-self: center; border-radius: 999px; border: 1px solid var(--t-border); background: var(--t-surface); color: var(--t-text-2); font: inherit; font-weight: 600; padding: 0 14px; cursor: pointer; }
.tn-nul[aria-pressed="true"] { background: var(--t-surface-2); color: var(--t-text); border-color: var(--t-text-3); }
.tn-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
.tn-table th { text-align: left; font-size: 0.78rem; color: var(--t-text-3); font-weight: 600; padding: 6px 4px; border-bottom: 1px solid var(--t-line); }
.tn-table td { padding: 8px 4px; border-bottom: 1px solid var(--t-line); }
.tn-table .r { text-align: right; }
.tn-banner { border-radius: 14px; padding: 16px 18px; background: var(--t-accent); color: var(--t-on-accent); display: grid; gap: 4px; }
.tn-clock { position: sticky; top: 8px; z-index: 5; border-radius: 14px; padding: 12px 16px; background: var(--t-text); color: var(--t-surface); display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.tn-clock strong { font-size: 2rem; letter-spacing: 0.02em; }
.tn-note { margin: 0; padding: 8px 12px; border-radius: 10px; background: var(--t-warn-soft); color: var(--t-warn); font-size: 0.88rem; }
.tn-input { min-height: 44px; width: 96px; border-radius: 10px; border: 1px solid var(--t-border); background: var(--t-surface); color: var(--t-text); font: inherit; font-weight: 700; text-align: center; font-size: 1.05rem; }
@media (max-width: 480px) {
  .tn-card { padding: 14px; }
  .tn-row { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); grid-template-areas: "ta . tb" "sa dash sb"; gap: 6px; }
  .tn-row > .ta { grid-area: ta; } .tn-row > .tb { grid-area: tb; } .tn-row > .sa { grid-area: sa; } .tn-row > .sb { grid-area: sb; } .tn-row > .dash { grid-area: dash; }
}
`;

const PHASE_TITLE: Record<ScheduledMatch["phase"], string> = { poule: "Match", demi: "Demi-finale", "petite-finale": "Petite finale (3e place)", finale: "Finale" };
const minLabel = (m: number) => `${m} min`;

function Dot({ color }: { color: string | null | undefined }) {
  const hex = colorHex(color ?? null);
  return <span aria-hidden className="tn-dot" style={{ background: hex ?? "transparent" }} />;
}

/** Bip et vibration à la fin d'un match (minuteur). */
function ring() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime + t);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.25);
    });
  } catch {
    /* pas de son sur cet appareil */
  }
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}

type Sync = "saved" | "pending" | "saving" | "error";

export function PracticeTournament({ endpoint, query = "", initial = null, title }: { endpoint: string; query?: string; initial?: TournamentContext | null; title?: string }) {
  const [ctx, setCtx] = useState<TournamentContext | null>(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<TournamentState | null>(initial?.saved ?? null);
  const [sync, setSync] = useState<Sync>("saved");
  const [syncError, setSyncError] = useState<string | null>(null);
  const storeKey = ctx ? `nv-tournoi-${ctx.activityId}` : null;

  // Réglages du nouveau tournoi.
  const [present, setPresent] = useState<Set<string>>(() => new Set((initial?.players ?? []).filter((p) => !p.absent).map((p) => p.id)));
  const [format, setFormat] = useState<TournamentFormat>(4);
  const [finish, setFinish] = useState<TournamentFinish>("finale");
  const [duration, setDuration] = useState(30);
  const [fields, setFields] = useState<number | null>(null);
  const [changeover, setChangeover] = useState(1);
  const [rounds, setRounds] = useState<1 | 2>(1);

  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [clock, setClock] = useState<{ wave: number; endsAt: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Chargement (portail, admin) quand la page ne l'a pas fourni.
  useEffect(() => {
    if (initial) return;
    fetch(`${endpoint}${query}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.context) throw new Error(d?.error ?? "Tournoi introuvable");
        setCtx(d.context);
        setState(d.context.saved);
        setPresent(new Set((d.context.players as TournamentContext["players"]).filter((p) => !p.absent).map((p) => p.id)));
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Erreur"));
  }, [endpoint, query, initial]);

  // Ce qui a été fait sur cet appareil sans réseau passe avant ce que le serveur avait.
  useEffect(() => {
    if (!storeKey) return;
    try {
      const raw = localStorage.getItem(storeKey);
      if (!raw) return;
      const local = JSON.parse(raw) as { state: TournamentState | null; dirty: boolean; at: number };
      if (local.dirty) {
        setState(local.state);
        setSync("pending");
      }
    } catch {
      /* stockage indisponible */
    }
  }, [storeKey]);

  const push = useCallback(
    async (next: TournamentState | null) => {
      if (!ctx) return;
      setSync("saving");
      try {
        const res = next
          ? await fetch(`${endpoint}${query}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...next, theme: ctx.theme, cle: new URLSearchParams(query.replace(/^\?/, "")).get("cle") }) })
          : await fetch(`${endpoint}${query}`, { method: "DELETE" });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSync("error");
          setSyncError(d?.error ?? "Erreur");
          return;
        }
        setSync("saved");
        setSyncError(null);
        try {
          if (storeKey) localStorage.setItem(storeKey, JSON.stringify({ state: next, dirty: false, at: Date.now() }));
        } catch {
          /* rien */
        }
      } catch {
        setSync("pending");
      }
    },
    [ctx, endpoint, query, storeKey]
  );

  const latest = useRef<TournamentState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = useCallback(
    (next: TournamentState | null, immediate = false) => {
      setState(next);
      latest.current = next;
      setSync("pending");
      try {
        if (storeKey) localStorage.setItem(storeKey, JSON.stringify({ state: next, dirty: true, at: Date.now() }));
      } catch {
        /* rien */
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => push(latest.current), immediate ? 0 : 800);
    },
    [push, storeKey]
  );

  // Réseau revenu, ou essai toutes les 20 secondes tant que ce n'est pas enregistré.
  useEffect(() => {
    if (sync !== "pending") return;
    const retry = () => push(state);
    window.addEventListener("online", retry);
    const id = setInterval(retry, 20000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(id);
    };
  }, [sync, state, push]);

  useEffect(() => {
    if (!clock) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= clock.endsAt) {
        ring();
        setClock(null);
      }
    }, 250);
    return () => clearInterval(id);
  }, [clock]);

  const players = useMemo(() => ctx?.players ?? [], [ctx]);
  const nameOf = useMemo(() => new Map(players.map((p) => [p.id, p.name])), [players]);
  const ratingOf = useMemo(() => new Map(players.map((p) => [p.id, p.rating])), [players]);

  if (loadError) return <div className="tn"><style>{CSS}</style><div className="tn-card"><p className="tn-sub">{loadError}</p></div></div>;
  if (!ctx) return <div className="tn"><style>{CSS}</style><div className="tn-card"><p className="tn-sub">Chargement du tournoi…</p></div></div>;

  const syncLine =
    sync === "saved" ? "Enregistré" : sync === "saving" ? "Enregistrement…" : sync === "pending" ? "Gardé sur l'appareil · s'enregistre dès que le réseau revient" : `Pas enregistré : ${syncError ?? "erreur"}`;

  /* ── Réglages : nouveau tournoi ── */
  if (!state) {
    const here = players.filter((p) => present.has(p.id));
    const plan = teamPlan(here.length, format);
    const f = fields ?? defaultFields(plan.teams);
    const settings: TournamentSettings = { format, finish: finishFor(plan.teams, finish), durationMin: duration, fields: f, changeoverMin: changeover, rounds };
    const preview = plan.teams >= 2 ? buildSchedule(plan.teams, settings) : null;
    const poolCount = preview?.matches.filter((m) => m.phase === "poule").length ?? 0;
    const start = () => {
      const teams = formTournamentTeams(here.map((p) => ({ id: p.id, rating: p.rating })), format, ctx.history, Date.now());
      commit({ settings, teams, results: {}, present: here.map((p) => p.id), updatedAt: null }, true);
      setEditing(false);
    };
    return (
      <div className="tn">
        <style>{CSS}</style>
        <section className="tn-card">
          <div>
            <h2 className="tn-h"><Trophy size={20} aria-hidden /> {title ?? "Tournoi de fin de pratique"}</h2>
            <p className="tn-sub">{ctx.title}{ctx.theme ? ` · thème : ${ctx.theme}` : ""}</p>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <p className="tn-label">Qui est là ? {here.length} fille{here.length > 1 ? "s" : ""} (touche une fille pour l&apos;enlever ou la remettre)</p>
            <div className="tn-seg">
              {players.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="tn-chip"
                  aria-pressed={present.has(p.id)}
                  onClick={() =>
                    setPresent((s) => {
                      const n = new Set(s);
                      if (n.has(p.id)) n.delete(p.id);
                      else n.add(p.id);
                      return n;
                    })
                  }
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <p className="tn-label">Format</p>
            <div className="tn-seg">
              {TOURNAMENT_FORMATS.map((x) => (
                <button key={x} type="button" aria-pressed={format === x} onClick={() => setFormat(x)}>{formatLabel(x)}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <p className="tn-label">Après le classement</p>
            <div className="tn-seg">
              {FINISHES.map((x) => (
                <button key={x.key} type="button" aria-pressed={settings.finish === x.key} disabled={finishFor(plan.teams, x.key) !== x.key} onClick={() => setFinish(x.key)}>{x.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="tn-label">Durée du tournoi (minutes)</span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input className="tn-input" type="number" inputMode="numeric" min={4} max={180} value={duration} onChange={(e) => setDuration(Math.max(0, Number(e.target.value) || 0))} />
                <span className="tn-seg">
                  {[15, 20, 25, 30, 40].map((m) => (
                    <button key={m} type="button" aria-pressed={duration === m} onClick={() => setDuration(m)}>{m}</button>
                  ))}
                </span>
              </span>
            </label>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <span className="tn-label">Matchs en même temps (terrains)</span>
              <div className="tn-seg">
                {[1, 2, 3].map((n) => (
                  <button key={n} type="button" aria-pressed={f === n} onClick={() => setFields(n)}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <span className="tn-label">Changement entre les matchs</span>
              <div className="tn-seg">
                {[0, 1, 2].map((n) => (
                  <button key={n} type="button" aria-pressed={changeover === n} onClick={() => setChangeover(n)}>{n} min</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <span className="tn-label">Chaque équipe affronte les autres</span>
              <div className="tn-seg">
                <button type="button" aria-pressed={rounds === 1} onClick={() => setRounds(1)}>1 fois</button>
                <button type="button" aria-pressed={rounds === 2} onClick={() => setRounds(2)}>2 fois</button>
              </div>
            </div>
          </div>

          {plan.teams >= 2 && preview ? (
            <div style={{ display: "grid", gap: 6, padding: "12px 14px", borderRadius: 12, background: "var(--t-surface-2)" }}>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {plan.teams} équipes de {Math.floor(here.length / plan.teams)}
                {plan.jokers ? ` · ${plan.jokers} équipe${plan.jokers > 1 ? "s" : ""} avec une joker (une fille de plus)` : ""}
                {plan.short ? ` · ${plan.short} équipe${plan.short > 1 ? "s" : ""} avec une fille de moins` : ""}
              </p>
              <p className="tn-sub">
                {poolCount} match{poolCount > 1 ? "s" : ""} de classement
                {settings.finish === "finale" ? " + la finale" : settings.finish === "demi-finales" ? " + demi-finales et finale" : ""} · {preview.waves} manche{preview.waves > 1 ? "s" : ""} · <strong style={{ color: "var(--t-text)" }}>matchs de {minLabel(preview.matchMin)}</strong>
              </p>
              {preview.tooShort ? <p className="tn-note">Trop court : moins de 2 minutes par match. Allonge le tournoi, ajoute un terrain ou joue 1 fois.</p> : null}
            </div>
          ) : (
            <p className="tn-note">Il faut au moins 2 filles présentes pour former 2 équipes.</p>
          )}

          <button type="button" className="tn-primary" disabled={plan.teams < 2 || duration < 4} onClick={start}>
            <Shuffle size={18} aria-hidden /> Former les équipes
          </button>
          <p className="tn-sub" style={{ fontSize: "0.82rem" }}>
            Le site forme des équipes nouvelles (pas toujours les mêmes ensemble), équilibrées selon les évaluations des filles, et choisit une capitaine qui ne l&apos;a pas été récemment.
          </p>
        </section>
      </div>
    );
  }

  /* ── Le tournoi ── */
  const s = state.settings;
  const teams = state.teams;
  const schedule = buildSchedule(teams.length, s);
  const table = standings(teams.length, schedule.matches, state.results);
  const done = poolDone(schedule.matches, state.results);
  const champ = champion(schedule.matches, state.results, table);
  const teamOf = (i: number | null) => (i == null ? null : teams[i] ?? null);

  const setTeams = (next: TournamentTeam[]) => commit({ ...state, teams: next.map((t) => ({ ...t, label: t.color, joker: t.members.length > s.format })) });
  const setResult = (id: string, r: MatchResult) => commit({ ...state, results: { ...state.results, [id]: r } });

  const swap = (id: string) => {
    if (!picked) return setPicked(id);
    if (picked === id) return setPicked(null);
    const next = teams.map((t) => ({ ...t, members: t.members.map((m) => (m === picked ? id : m === id ? picked : m)) }));
    // La capitaine change d'équipe : chaque équipe garde une capitaine qui en fait partie.
    next.forEach((t) => {
      if (t.captain && !t.members.includes(t.captain)) t.captain = t.captain === picked ? id : t.captain === id ? picked : t.members[0] ?? null;
    });
    setTeams(next);
    setPicked(null);
  };
  const moveTo = (ti: number) => {
    if (!picked) return;
    const next = teams.map((t, i) => ({ ...t, members: i === ti ? [...t.members.filter((m) => m !== picked), picked] : t.members.filter((m) => m !== picked) }));
    next.forEach((t) => {
      if (t.captain && !t.members.includes(t.captain)) t.captain = t.members[0] ?? null;
    });
    setTeams(next);
    setPicked(null);
  };
  const nextColor = (ti: number) => {
    const used = new Set(teams.map((t) => t.color));
    const start = TOURNAMENT_COLORS.indexOf(teams[ti].color);
    for (let k = 1; k <= TOURNAMENT_COLORS.length; k++) {
      const c = TOURNAMENT_COLORS[(start + k) % TOURNAMENT_COLORS.length];
      if (!used.has(c)) return setTeams(teams.map((t, i) => (i === ti ? { ...t, color: c } : t)));
    }
  };
  const reshuffle = () => {
    if (Object.keys(state.results).length && !window.confirm("Refaire les équipes efface les scores déjà entrés. On continue ?")) return;
    const here = players.filter((p) => state.present.includes(p.id));
    commit({ ...state, teams: formTournamentTeams(here.map((p) => ({ id: p.id, rating: p.rating })), s.format, ctx.history, Date.now()), results: {} }, true);
  };
  const restart = () => {
    if (!window.confirm("Recommencer un nouveau tournoi ? Les scores de celui-ci seront effacés (les équipes restent dans l'historique).")) return;
    setPresent(new Set(state.present));
    setFormat(s.format);
    setDuration(s.durationMin);
    setFinish(s.finish);
    setChangeover(s.changeoverMin);
    setRounds(s.rounds);
    setFields(s.fields);
    commit(null, true);
  };

  const waves = Array.from({ length: schedule.waves }, (_, w) => schedule.matches.filter((m) => m.wave === w));
  const remaining = clock ? Math.max(0, Math.ceil((clock.endsAt - now) / 1000)) : 0;

  const teamName = (i: number | null, provisional?: boolean) => {
    const t = teamOf(i);
    return t ? (
      <>
        <Dot color={t.color} />
        <span className="n">{t.label}</span>
        {provisional ? <span style={{ fontWeight: 500, fontSize: "0.75rem", color: "var(--t-text-3)" }}>(pour l&apos;instant)</span> : null}
      </>
    ) : (
      <span className="n" style={{ color: "var(--t-text-3)", fontWeight: 500 }}>À venir</span>
    );
  };

  const matchCard = (m: ScheduledMatch, index: number) => {
    const a = resolveSlot(m.a, schedule.matches, state.results, table);
    const b = resolveSlot(m.b, schedule.matches, state.results, table);
    const ready = a != null && b != null;
    const provisional = m.phase !== "poule" && ("rank" in m.a) && !done;
    const r = state.results[m.id] ?? { a: null, b: null, winner: null };
    const o = outcome(r);
    const knockout = m.phase !== "poule";
    const tie = knockout && r.a != null && r.b != null && r.a === r.b;
    const tap = (w: "a" | "b" | "nul") => setResult(m.id, { a: r.a, b: r.b, winner: r.winner === w ? null : w });
    const score = (side: "a" | "b", v: string) => {
      const n = v === "" ? null : Math.max(0, Math.min(99, Math.round(Number(v)) || 0));
      setResult(m.id, { ...r, [side]: n, winner: null });
    };
    return (
      <div className="tn-match">
        <p className="tn-label" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>{m.phase === "poule" ? `Match ${index}` : PHASE_TITLE[m.phase]}{schedule.waves && s.fields > 1 ? ` · terrain ${m.field}` : ""}</span>
          {o ? <span style={{ color: "var(--t-good)" }}>{o === "nul" ? "Nul" : `Victoire : ${teamOf(o === "a" ? a : b)?.label ?? ""}`}</span> : null}
        </p>
        <div className="tn-row">
          <button type="button" className="tn-team-btn ta" data-win={o === "a"} disabled={!ready} onClick={() => tap("a")} aria-label={`${teamOf(a)?.label ?? "Équipe"} gagne`}>
            {teamName(a, provisional)}
          </button>
          <input className="tn-score sa" type="number" inputMode="numeric" min={0} max={99} placeholder="Buts" aria-label={`Buts ${teamOf(a)?.label ?? ""}`} disabled={!ready} value={r.a ?? ""} onChange={(e) => score("a", e.target.value)} />
          <span aria-hidden className="dash" style={{ color: "var(--t-text-3)", fontWeight: 700, textAlign: "center" }}>–</span>
          <input className="tn-score sb" type="number" inputMode="numeric" min={0} max={99} placeholder="Buts" aria-label={`Buts ${teamOf(b)?.label ?? ""}`} disabled={!ready} value={r.b ?? ""} onChange={(e) => score("b", e.target.value)} />
          <button type="button" className="tn-team-btn tb" data-win={o === "b"} disabled={!ready} onClick={() => tap("b")} aria-label={`${teamOf(b)?.label ?? "Équipe"} gagne`}>
            {teamName(b, provisional)}
          </button>
        </div>
        {!knockout ? (
          <button type="button" className="tn-nul" aria-pressed={o === "nul"} disabled={!ready} onClick={() => tap("nul")}>Match nul</button>
        ) : tie && !r.winner ? (
          <p className="tn-note" style={{ textAlign: "center" }}>Égalité : touche l&apos;équipe qui gagne aux tirs au but.</p>
        ) : null}
      </div>
    );
  };

  let poolIndex = 0;
  const champTeam = teamOf(champ);

  return (
    <div className="tn">
      <style>{CSS}</style>

      {clock ? (
        <div className="tn-clock" role="timer" aria-live="polite">
          <span>Manche {clock.wave + 1}</span>
          <strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong>
          <button type="button" className="tn-ghost" onClick={() => setClock(null)}>Arrêter</button>
        </div>
      ) : null}

      <section className="tn-card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "start" }}>
          <div>
            <h2 className="tn-h"><Trophy size={20} aria-hidden /> Tournoi {formatLabel(s.format)}</h2>
            <p className="tn-sub">
              {s.durationMin} min · {teams.length} équipes · <strong style={{ color: "var(--t-text)" }}>matchs de {minLabel(schedule.matchMin)}</strong>
              {s.changeoverMin ? ` · ${s.changeoverMin} min de changement` : ""} · {s.fields} terrain{s.fields > 1 ? "s" : ""}
            </p>
            <p className="tn-sub" style={{ fontSize: "0.8rem", color: sync === "error" ? "var(--t-bad)" : "var(--t-text-3)" }}>{syncLine}</p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="tn-ghost" aria-pressed={editing} onClick={() => { setEditing((e) => !e); setPicked(null); }}>
              <UserPlus size={16} aria-hidden /> {editing ? "Terminé" : "Modifier les équipes"}
            </button>
            <button type="button" className="tn-ghost" onClick={reshuffle}><RefreshCw size={16} aria-hidden /> Refaire les équipes</button>
            <button type="button" className="tn-ghost" onClick={restart}>Nouveau tournoi</button>
          </div>
        </div>
        {schedule.tooShort ? <p className="tn-note">Moins de 2 minutes par match : allonge le tournoi ou ajoute un terrain (Nouveau tournoi).</p> : null}
      </section>

      {champTeam ? (
        <div className="tn-banner" role="status">
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "1.2rem", fontWeight: 800 }}><Trophy size={22} aria-hidden /> Championnes : {champTeam.label}</span>
          <span>{champTeam.members.map((m) => nameOf.get(m) ?? "?").join(", ")}</span>
        </div>
      ) : null}

      <section className="tn-card">
        <div>
          <h3 className="tn-h" style={{ fontSize: "1.05rem" }}>Les équipes</h3>
          {editing ? (
            <p className="tn-sub">Touche une fille, puis une fille d&apos;une autre équipe pour les échanger, ou le nom d&apos;une équipe pour l&apos;y envoyer. Touche la pastille pour changer la couleur.</p>
          ) : null}
        </div>
        <div className="tn-teams">
          {teams.map((t, ti) => {
            const strength = teamStrength(t.members, ratingOf);
            return (
              <div key={ti} className="tn-team">
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                  {editing ? (
                    <button type="button" className="tn-member" style={{ width: "auto", margin: 0, fontWeight: 700 }} onClick={() => (picked ? moveTo(ti) : nextColor(ti))}>
                      <Dot color={t.color} /> {t.label}
                    </button>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}><Dot color={t.color} /> {t.label}</span>
                  )}
                  {t.joker ? <span className="tn-pill">+1 joker</span> : null}
                </div>
                <ul>
                  {[...t.members].sort((x, y) => Number(y === t.captain) - Number(x === t.captain)).map((m) => (
                    <li key={m}>
                      {editing ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <button type="button" className="tn-member" data-picked={picked === m} onClick={() => swap(m)}>
                            {nameOf.get(m) ?? "?"}
                          </button>
                          <button
                            type="button"
                            className="tn-ghost"
                            style={{ minHeight: 32, padding: "0 8px" }}
                            aria-pressed={t.captain === m}
                            aria-label={`${nameOf.get(m) ?? "Elle"} capitaine`}
                            title="Capitaine"
                            onClick={() => setTeams(teams.map((x, i) => (i === ti ? { ...x, captain: m } : x)))}
                          >
                            <Crown size={14} aria-hidden style={{ color: t.captain === m ? "var(--t-accent)" : "var(--t-text-3)" }} />
                          </button>
                        </span>
                      ) : (
                        <span className="tn-member">
                          {nameOf.get(m) ?? "?"}
                          {t.captain === m ? <span className="tn-pill" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Crown size={12} aria-hidden /> Capitaine</span> : null}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {strength != null ? <p className="tn-label" style={{ fontWeight: 500 }}>Force moyenne {String(strength).replace(".", ",")} sur 5</p> : null}
              </div>
            );
          })}
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--t-accent-soft)" }}>
          <p className="tn-label" style={{ color: "var(--t-accent)" }}>Ce qu&apos;on demande aux capitaines{ctx.theme ? ` · thème : ${ctx.theme}` : ""}</p>
          <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{ctx.captainTask}</p>
        </div>
      </section>

      <section className="tn-card">
        <h3 className="tn-h" style={{ fontSize: "1.05rem" }}>Qui contre qui</h3>
        {waves.map((ms, w) => {
          const first = ms[0];
          const rest = schedule.rest[w] ?? [];
          return (
            <div key={w} className="tn-wave">
              <div className="tn-wave-head">
                <p className="tn-label" style={{ fontSize: "0.85rem" }}>
                  {minLabel(first.start)} à {minLabel(first.end)}
                  {first.phase === "poule" && rest.length ? ` · au repos : ${rest.map((i) => teams[i]?.label).join(", ")}` : ""}
                </p>
                <button type="button" className="tn-ghost" style={{ minHeight: 36 }} onClick={() => { setNow(Date.now()); setClock({ wave: w, endsAt: Date.now() + schedule.matchMin * 60000 }); }}>
                  <Timer size={15} aria-hidden /> Chrono {minLabel(schedule.matchMin)}
                </button>
              </div>
              {ms.map((m) => <div key={m.id}>{matchCard(m, m.phase === "poule" ? ++poolIndex : 0)}</div>)}
            </div>
          );
        })}
      </section>

      <section className="tn-card">
        <h3 className="tn-h" style={{ fontSize: "1.05rem" }}>Classement en direct</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="tn-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Équipe</th>
                <th className="r">J</th>
                <th className="r">V</th>
                <th className="r">N</th>
                <th className="r">D</th>
                <th className="r">Diff.</th>
                <th className="r">Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={row.team}>
                  <td>{i + 1}</td>
                  <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}><Dot color={teams[row.team]?.color} /> {teams[row.team]?.label}</span></td>
                  <td className="r">{row.played}</td>
                  <td className="r">{row.won}</td>
                  <td className="r">{row.drawn}</td>
                  <td className="r">{row.lost}</td>
                  <td className="r">{row.diff > 0 ? `+${row.diff}` : row.diff}</td>
                  <td className="r" style={{ fontWeight: 800 }}>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tn-sub" style={{ fontSize: "0.8rem" }}>Victoire = 2 points · Nul = 1 point · Défaite = 0. Égalité départagée par la différence de buts, puis les buts marqués.</p>
        <button
          type="button"
          className="tn-ghost danger"
          style={{ justifySelf: "start" }}
          onClick={() => window.confirm("Effacer tous les scores de ce tournoi ?") && commit({ ...state, results: {} as Results }, true)}
        >
          Effacer les scores
        </button>
      </section>
    </div>
  );
}

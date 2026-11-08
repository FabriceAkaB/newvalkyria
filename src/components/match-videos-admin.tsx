"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MatchPlayer } from "@/components/match-player";

export interface AdminVideoRow {
  id: string;
  kind: "match" | "pratique";
  status: string;
  date: string | null;
  title: string;
  veoTitle: string | null;
  teamName: string | null;
  duration: string;
  poster: string | null;
  goals: number;
  moments: number;
  published: boolean;
  views: number;
  reason: string | null;
  veoUrl: string | null;
  /** État de la copie gardée par l'académie (« Gardée par l'académie (3,1 Go) », « Téléchargement : 40 % »…). */
  archive: string;
}

export interface PlaceOption {
  kind: "match" | "pratique";
  teamId: string | null;
  mcsEventId: number | null;
  activityId: string | null;
  teamName: string;
  label: string;
}

const day = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

async function post(body: object) {
  const res = await fetch("/api/admin/videos-matchs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (body: object) => {
    setBusy(true);
    setError(null);
    try {
      const r = await post(body);
      router.refresh();
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const OUTCOME: Record<string, string> = { rangee: "Rangée", deja: "Déjà rangée", "a-classer": "À classer", ignoree: "Ignorée", "en-preparation": "Veo la prépare encore", erreur: "Erreur" };

function VeoSync() {
  const { busy, error, run } = useAction();
  const [res, setRes] = useState<{ skipped?: string; results: { title: string; date: string; outcome: string; where?: string; reason?: string }[] } | null>(null);
  const useful = (res?.results ?? []).filter((r) => r.outcome !== "ignoree");
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div>
        <button type="button" className="admin-btn-primary" disabled={busy} onClick={async () => setRes(await run({ action: "veo-sync" }))}>
          {busy ? "Lecture de Veo…" : "Aller chercher dans Veo maintenant"}
        </button>
      </div>
      {error ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p> : null}
      {res?.skipped ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-warn)" }}>{res.skipped}</p> : null}
      {res && !res.skipped ? (
        useful.length ? (
          <ul className="mda-sub" style={{ margin: 0, paddingLeft: 18 }}>
            {useful.map((r, i) => (
              <li key={i}>
                {r.date} · {r.title} : {OUTCOME[r.outcome] ?? r.outcome}
                {r.where ? ` (${r.where})` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mda-sub" style={{ margin: 0 }}>Aucun enregistrement « Newval » dans Veo pour l&apos;instant.</p>
        )
      ) : null}
    </div>
  );
}

function VeoLinks() {
  const { busy, error, run } = useAction();
  const [text, setText] = useState("");
  const [res, setRes] = useState<{ results: { title: string; date: string; outcome: string; where?: string; reason?: string }[] } | null>(null);
  const links = text.split(/\s+/).filter((x) => /veo\.co\/matches\//.test(x));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p className="mda-sub" style={{ margin: 0 }}>Ou colle le lien d&apos;un ou plusieurs enregistrements Veo (Partager → copier le lien) :</p>
      <textarea className="admin-input" rows={2} placeholder="https://app.veo.co/matches/…" value={text} onChange={(e) => setText(e.target.value)} />
      <div>
        <button
          type="button"
          className="admin-btn-ghost"
          disabled={busy || !links.length}
          onClick={async () => {
            const r = await run({ action: "veo-links", links });
            if (r) {
              setRes(r);
              setText("");
            }
          }}
        >
          {busy ? "Lecture…" : `Ranger ${links.length > 1 ? `ces ${links.length} enregistrements` : "cet enregistrement"}`}
        </button>
      </div>
      {error ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p> : null}
      {res ? (
        <ul className="mda-sub" style={{ margin: 0, paddingLeft: 18 }}>
          {res.results.map((r, i) => (
            <li key={i}>
              {r.date} {r.title} : {OUTCOME[r.outcome] ?? r.outcome}
              {r.where ? ` (${r.where})` : ""}
              {r.reason && r.outcome !== "rangee" ? ` — ${r.reason}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function VeoAccount({ status }: { status: { email: string; updatedAt: string | null } | null }) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(!status);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p className="mda-sub" style={{ margin: 0 }}>
        Toutes les heures, le site regarde dans Veo et prend les enregistrements dont le titre commence par <strong>« Newval »</strong> et les range seul, d&apos;après le jour et l&apos;heure : un match va dans l&apos;espace client des familles de l&apos;équipe, une pratique dans le portail des éducateurs. Chaque vidéo est aussi téléchargée en 1080p et gardée par l&apos;académie : Veo efface ses enregistrements après environ un an, notre copie reste. Si deux activités ont lieu en même temps, mets l&apos;équipe dans le titre (ex. « Newval 2015 AV match »).
      </p>
      {open ? (
        <div style={{ display: "grid", gap: 8 }}>
          <p className="mda-sub" style={{ margin: 0 }}>Ton compte Veo, tapé par toi. Le mot de passe est gardé chiffré et n&apos;est jamais réaffiché.</p>
          <input className="admin-input" placeholder="Courriel Veo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          <input className="admin-input" placeholder="Mot de passe Veo" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <div>
            <button
              type="button"
              className="admin-btn-primary"
              disabled={busy || !email || !password}
              onClick={async () => {
                if (await run({ action: "veo", email, password, club: "anoble-76395aca" })) {
                  setPassword("");
                  setOpen(false);
                }
              }}
            >
              Enregistrer le compte Veo
            </button>
          </div>
          {error ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p> : null}
        </div>
      ) : (
        <>
          <p className="mda-sub" style={{ margin: 0 }}>
            Compte Veo : {status?.email}
            {status?.updatedAt ? ` (enregistré le ${new Date(status.updatedAt).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })})` : ""}.{" "}
            <button type="button" className="admin-btn-ghost" onClick={() => setOpen(true)}>
              Changer
            </button>
          </p>
          <VeoSync />
        </>
      )}
    </div>
  );
}

function Thumb({ v }: { v: AdminVideoRow }) {
  return v.poster ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={v.poster} alt="" style={{ width: 112, aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 8, flex: "none", background: "#000" }} />
  ) : null;
}

function ToClassify({ v, options, teams }: { v: AdminVideoRow; options: PlaceOption[]; teams: PlaceOption[] }) {
  const { busy, error, run } = useAction();
  const all = [...options, ...teams.filter((t) => !options.some((o) => o.teamId === t.teamId && o.kind === t.kind))];
  const [pick, setPick] = useState(all.length ? "0" : "");
  const o = pick === "" ? null : all[Number(pick)];
  return (
    <li className="mda-task" style={{ display: "block" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Thumb v={v} />
        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
          <span className="mda-task-title" style={{ fontWeight: 600 }}>{v.veoTitle ?? v.title}</span>
          <span className="mda-sub" style={{ margin: 0 }}>
            {day(v.date)}
            {v.duration ? ` · ${v.duration}` : ""}
            {v.reason ? ` · ${v.reason}` : ""}
            {` · ${v.archive}`}
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="admin-input" style={{ flex: "1 1 260px", minWidth: 0 }} value={pick} onChange={(e) => setPick(e.target.value)}>
              {all.map((x, i) => (
                <option key={i} value={String(i)}>
                  {x.label}
                </option>
              ))}
            </select>
            <button type="button" className="admin-btn-primary" disabled={busy || !o} onClick={() => o && run({ action: "assign", id: v.id, kind: o.kind, teamId: o.teamId, mcsEventId: o.mcsEventId, activityId: o.activityId, teamName: o.teamName })}>
              Ranger ici
            </button>
            <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => window.confirm("Ne pas ranger cette vidéo ? Elle est retirée du site, copie de l'académie comprise.") && run({ action: "delete", id: v.id })}>
              Ne pas ranger
            </button>
          </div>
          {error ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p> : null}
        </div>
      </div>
    </li>
  );
}

function VideoRow({ v }: { v: AdminVideoRow }) {
  const { busy, error, run } = useAction();
  return (
    <li className="mda-task" style={{ display: "block" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Thumb v={v} />
        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
          <span className="mda-task-title" style={{ fontWeight: 600 }}>{v.title}</span>
          <div className="mda-task-meta">
            <span>{day(v.date)}</span>
            {v.duration ? <span>{v.duration}</span> : null}
            {v.goals ? <span>{v.goals} but{v.goals > 1 ? "s" : ""}</span> : null}
            {v.moments ? <span>{v.moments} temps forts</span> : null}
            <span>{v.archive}</span>
            {v.kind === "match" ? <span>{v.published ? `Dans l'espace client · ${v.views} visionnement${v.views > 1 ? "s" : ""}` : "Retirée de l'espace client"}</span> : <span>Éducateurs seulement</span>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {v.kind === "match" ? (
              <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => run({ action: "publish", id: v.id, publish: !v.published })}>
                {v.published ? "Retirer de l'espace client" : "Remettre dans l'espace client"}
              </button>
            ) : null}
            {v.veoUrl ? (
              <a className="admin-btn-ghost" href={v.veoUrl} target="_blank" rel="noreferrer">
                Ouvrir dans Veo ↗
              </a>
            ) : null}
            <button
              type="button"
              className="admin-btn-ghost"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Retirer cette vidéo du site ? La copie gardée par l'académie est effacée aussi (Veo garde la sienne jusqu'à son expiration).")) run({ action: "delete", id: v.id });
              }}
            >
              Retirer du site
            </button>
          </div>
          {error ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p> : null}
        </div>
      </div>
      <div style={{ marginTop: 10, maxWidth: 760 }}>
        <MatchPlayer id={v.id} endpoint={`/api/admin/videos-matchs?play=${v.id}`} label="Regarder" palette="admin" />
      </div>
    </li>
  );
}

function List({ title, rows, empty }: { title: string; rows: AdminVideoRow[]; empty: string }) {
  return (
    <section className="mda-card-flush">
      <div className="mda-card-head">
        <h2 className="mda-h2">{title}</h2>
      </div>
      {rows.length ? (
        <ul className="mda-tasks">
          {rows.map((v) => (
            <VideoRow key={v.id} v={v} />
          ))}
        </ul>
      ) : (
        <p style={{ padding: "14px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>{empty}</p>
      )}
    </section>
  );
}

export interface ArchiveSummary {
  kept: number;
  keptGo: string;
  waiting: number;
  blocked: string | null;
}

/** La copie de l'académie : combien de vidéos sont gardées, combien attendent, et le blocage s'il y en a un. */
function Archive({ a }: { a: ArchiveSummary }) {
  const { busy, error, run } = useAction();
  const [res, setRes] = useState<string | null>(null);
  return (
    <section className="mda-card">
      <h2 className="mda-h2" style={{ marginTop: 0 }}>Nos copies des vidéos</h2>
      <p className="mda-sub" style={{ margin: 0 }}>
        {a.kept} vidéo{a.kept > 1 ? "s" : ""} gardée{a.kept > 1 ? "s" : ""} par l&apos;académie ({a.keptGo}){a.waiting ? ` · ${a.waiting} à télécharger (le site continue chaque heure, environ 3 Go par match)` : " · tout est téléchargé"}. Tant que Veo garde la vidéo, on la lit chez Veo ; ensuite, notre copie prend le relais sans que personne ne s&apos;en aperçoive.
      </p>
      {a.blocked ? <p className="mda-sub" style={{ margin: "8px 0 0", color: "var(--adm-bad)" }}>{a.blocked}</p> : null}
      {a.waiting ? (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="admin-btn-ghost"
            disabled={busy}
            onClick={async () => {
              const r = await run({ action: "archive" });
              if (r) setRes(r.done?.length ? `${r.done.length} vidéo(s) terminée(s).` : r.progress?.length ? `En cours : ${r.progress[0].pct} %. La suite continue toute seule.` : r.errors?.length ? r.errors[0].error : "Rien à télécharger.");
            }}
          >
            {busy ? "Téléchargement… (jusqu'à 2 min)" : "Télécharger maintenant"}
          </button>
        </div>
      ) : null}
      {res ? <p className="mda-sub" style={{ margin: "8px 0 0" }}>{res}</p> : null}
      {error ? <p className="mda-sub" style={{ margin: "8px 0 0", color: "var(--adm-bad)" }}>{error}</p> : null}
    </section>
  );
}

export function MatchVideosAdmin({ videos, toClassify, teams, veo, archive }: { videos: AdminVideoRow[]; toClassify: { v: AdminVideoRow; options: PlaceOption[] }[]; teams: PlaceOption[]; veo: { email: string; updatedAt: string | null } | null; archive: ArchiveSummary }) {
  return (
    <>
      <section className="mda-card">
        <h2 className="mda-h2" style={{ marginTop: 0 }}>Veo</h2>
        <div style={{ display: "grid", gap: 16 }}>
          <VeoAccount status={veo} />
          <VeoLinks />
        </div>
      </section>
      {toClassify.length ? (
        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">À classer · {toClassify.length}</h2>
          </div>
          <ul className="mda-tasks">
            {toClassify.map((x) => (
              <ToClassify key={x.v.id} v={x.v} options={x.options} teams={teams} />
            ))}
          </ul>
        </section>
      ) : null}
      <Archive a={archive} />
      <List title="Matchs (familles de l'équipe)" rows={videos.filter((v) => v.kind === "match")} empty="Aucun match rangé pour l'instant." />
      <List title="Pratiques (éducateurs seulement)" rows={videos.filter((v) => v.kind === "pratique")} empty="Aucune pratique rangée pour l'instant." />
    </>
  );
}

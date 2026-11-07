"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StreamPlayer } from "@/components/stream-player";

export interface AdminVideoRow {
  id: string;
  kind: "match" | "pratique";
  date: string;
  title: string;
  teamName: string | null;
  status: "importation" | "traitement" | "pret" | "erreur";
  duration: string;
  error: string | null;
  published: boolean;
  source: string;
  consent: { oui: string[]; non: string[]; sansReponse: string[]; total: number };
  views: number;
}

export interface FilmablePractice {
  activityId: string;
  date: string;
  start: string;
  title: string;
}

export interface FilmableMatch {
  teamId: string;
  teamName: string;
  mcsEventId: number | null;
  date: string;
  title: string;
}

const STATUS: Record<AdminVideoRow["status"], string> = { importation: "Importation en cours", traitement: "Conversion en cours", pret: "Prête", erreur: "Erreur" };
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

async function post(body: object) {
  const res = await fetch("/api/admin/videos-matchs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json;
}

/** Envoi tus par morceaux de 50 Mo, directement chez Cloudflare (reprend où il était si la connexion coupe). */
async function tusUpload(url: string, file: File, onProgress: (p: number) => void) {
  const CHUNK = 50 * 1024 * 1024;
  let offset = 0;
  let failures = 0;
  while (offset < file.size) {
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, body: file.slice(offset, Math.min(file.size, offset + CHUNK)) });
      if (!res.ok) throw new Error(String(res.status));
      offset = Number(res.headers.get("Upload-Offset") ?? offset + CHUNK);
      failures = 0;
      onProgress(offset / file.size);
    } catch {
      if (++failures > 6) throw new Error("L'envoi a échoué plusieurs fois : vérifie la connexion et recommence.");
      await new Promise((r) => setTimeout(r, 3000 * failures));
      const head = await fetch(url, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" } }).catch(() => null);
      const o = Number(head?.headers.get("Upload-Offset"));
      if (Number.isFinite(o) && o >= 0) offset = o;
    }
  }
}

function Connect() {
  const router = useRouter();
  const [accountId, setAccountId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ol className="mda-sub" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
        <li>Crée un compte sur dash.cloudflare.com (toi-même) et active <strong>Stream</strong> (Stream → Get started ; environ 5 $ US par mois au départ).</li>
        <li>Copie l&apos;<strong>Account ID</strong> (colonne de droite de la page d&apos;accueil du compte).</li>
        <li>Mon profil → API Tokens → Create Token → modèle « Edit Cloudflare Stream » → Create → copie la clé.</li>
        <li>Colle les deux ici. La clé est gardée chiffrée.</li>
      </ol>
      <input className="admin-input" placeholder="Account ID (32 caractères)" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
      <input className="admin-input" placeholder="Clé API Stream" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
      <div>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || !accountId || !token}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await post({ action: "config", accountId, token });
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Vérification…" : "Brancher Cloudflare Stream"}
        </button>
      </div>
      {error ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p> : null}
    </div>
  );
}

function AddVideo({ matches, practices }: { matches: FilmableMatch[]; practices: FilmablePractice[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"match" | "pratique">("match");
  const [pick, setPick] = useState(matches[0] ? "0" : "");
  const [mode, setMode] = useState<"lien" | "fichier">("lien");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const m = kind === "match" && pick !== "" ? matches[Number(pick)] : null;
  const pr = kind === "pratique" && pick !== "" ? practices[Number(pick)] : null;
  const base = m
    ? { kind, teamId: m.teamId, mcsEventId: m.mcsEventId, date: m.date, title: `${m.teamName} — ${m.title}`, opponent: null }
    : pr
      ? { kind, activityId: pr.activityId, teamId: null, mcsEventId: null, date: pr.date, title: `Pratique ${pr.start} — ${pr.title}` }
      : null;
  const list = kind === "match" ? matches.map((x) => `${day(x.date)} · ${x.teamName} · ${x.title}`) : practices.map((x) => `${day(x.date)} ${x.start} · ${x.title}`);

  const send = async () => {
    if (!base) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "lien") {
        await post({ action: "import-url", ...base, url: url.trim() });
        setMsg({ ok: true, text: "Cloudflare va chercher la vidéo. Elle sera prête dans quelques minutes (une vidéo de 2 h peut prendre une demi-heure)." });
        setUrl("");
      } else if (file) {
        const r = await post({ action: "start-upload", ...base, size: file.size, filename: file.name });
        setProgress(0);
        await tusUpload(r.uploadUrl, file, setProgress);
        setMsg({ ok: true, text: "Fichier envoyé. Cloudflare le convertit maintenant (quelques minutes)." });
        setFile(null);
      }
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className={kind === "match" ? "admin-btn-primary" : "admin-btn-ghost"} onClick={() => { setKind("match"); setPick(matches.length ? "0" : ""); }}>Match (familles de l&apos;équipe)</button>
        <button type="button" className={kind === "pratique" ? "admin-btn-primary" : "admin-btn-ghost"} onClick={() => { setKind("pratique"); setPick(practices.length ? "0" : ""); }}>Pratique (éducateurs seulement)</button>
      </div>
      <label style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
        {kind === "match" ? "Quel match ?" : "Quelle pratique ?"}
        <select className="admin-input" value={pick} onChange={(e) => setPick(e.target.value)}>
          {list.length ? null : <option value="">Rien ces 60 derniers jours</option>}
          {list.map((label, i) => (
            <option key={i} value={String(i)}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className={mode === "lien" ? "admin-btn-primary" : "admin-btn-ghost"} onClick={() => setMode("lien")}>Lien de téléchargement (Veo)</button>
        <button type="button" className={mode === "fichier" ? "admin-btn-primary" : "admin-btn-ghost"} onClick={() => setMode("fichier")}>Fichier de l&apos;ordinateur</button>
      </div>
      {mode === "lien" ? (
        <input className="admin-input" placeholder="https://… (Veo : Télécharger → copier le lien du fichier vidéo)" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
      ) : (
        <input className="admin-input" type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      )}
      <div>
        <button type="button" className="admin-btn-primary" disabled={busy || !base || (mode === "lien" ? !url : !file)} onClick={send}>
          {busy ? (progress !== null ? `Envoi ${Math.round(progress * 100)} %` : "Envoi…") : "Ajouter la vidéo"}
        </button>
      </div>
      {msg ? <p className="mda-sub" style={{ margin: 0, color: msg.ok ? "var(--adm-good)" : "var(--adm-bad)" }}>{msg.text}</p> : null}
    </div>
  );
}

function VideoRow({ v }: { v: AdminVideoRow }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = v.consent.non.length + v.consent.sansReponse.length;
  const act = async (body: object) => {
    setBusy(true);
    setError(null);
    try {
      await post(body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="mda-task" style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <span className="mda-task-title" style={{ fontWeight: 600 }}>{v.title}</span>
        <span className="mda-tnum" style={{ fontSize: "0.82rem", color: v.status === "erreur" ? "var(--adm-bad)" : v.status === "pret" ? "var(--adm-good)" : "var(--adm-warn)" }}>
          {v.published ? "Publiée aux familles" : v.kind === "pratique" && v.status === "pret" ? "Prête (éducateurs)" : STATUS[v.status]}
          {v.duration ? ` · ${v.duration}` : ""}
        </span>
      </div>
      <div className="mda-task-meta">
        <span>{day(v.date)}</span>
        {v.teamName ? <span>{v.teamName}</span> : null}
        {v.kind === "pratique" ? <span>Pratique : éducateurs seulement</span> : null}
        {v.kind === "match" ? <span>
          Accord photo et vidéo : {v.consent.oui.length} oui{v.consent.non.length ? ` · ${v.consent.non.length} non` : ""}{v.consent.sansReponse.length ? ` · ${v.consent.sansReponse.length} sans réponse` : ""} (sur {v.consent.total})
        </span> : null}
        {v.published ? <span>{v.views} lecture{v.views > 1 ? "s" : ""}</span> : null}
      </div>
      {v.error ? <p className="mda-sub" style={{ margin: "6px 0 0", color: "var(--adm-bad)" }}>{v.error}</p> : null}
      {v.consent.non.length ? <p className="mda-sub" style={{ margin: "6px 0 0" }}>Refus : {v.consent.non.join(", ")}</p> : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        {!v.published && v.status === "pret" && v.kind === "match" && missing > 0 ? (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.82rem" }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Je confirme : les joueuses sans accord ne sont pas reconnaissables, ou leurs familles sont d&apos;accord
          </label>
        ) : null}
        {v.status === "pret" && v.kind === "match" ? (
          <button type="button" className={v.published ? "admin-btn-ghost" : "admin-btn-primary"} disabled={busy || (!v.published && missing > 0 && !confirmed)} onClick={() => act({ action: "publish", id: v.id, publish: !v.published, confirmed })}>
            {v.published ? "Retirer de l'espace client" : "Publier aux familles"}
          </button>
        ) : null}
        <button
          type="button"
          className="admin-btn-ghost"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Supprimer cette vidéo (chez Cloudflare aussi) ? On ne peut pas la récupérer.")) act({ action: "delete", id: v.id });
          }}
        >
          Supprimer
        </button>
      </div>
      {error ? <p className="mda-sub" style={{ margin: "6px 0 0", color: "var(--adm-bad)" }}>{error}</p> : null}
      {v.status === "pret" ? (
        <div style={{ marginTop: 8, maxWidth: 640 }}>
          <StreamPlayer endpoint={`/api/admin/videos-matchs?play=${v.id}`} label="Aperçu" />
        </div>
      ) : null}
    </li>
  );
}

function VeoSync() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ skipped?: string; results: { title: string; date: string; outcome: string; where?: string; reason?: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const LABEL: Record<string, string> = { importee: "Rangée", deja: "Déjà rangée", "a-classer": "À classer", ignoree: "Ignorée", erreur: "Erreur" };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p className="mda-sub" style={{ margin: 0 }}>Chaque soir à 23 h, le site prend dans Veo les enregistrements dont le titre commence par « Newval » et les range tout seul. Mets l&apos;équipe dans le titre si deux activités ont lieu en même temps (ex. « Newval 2015 AV match »).</p>
      <div>
        <button
          type="button"
          className="admin-btn-ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setRes(await post({ action: "veo-sync" }));
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Lecture de Veo…" : "Aller chercher dans Veo maintenant"}
        </button>
      </div>
      {error ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p> : null}
      {res?.skipped ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-warn)" }}>{res.skipped}</p> : null}
      {res && !res.skipped ? (
        res.results.length ? (
          <ul className="mda-sub" style={{ margin: 0, paddingLeft: 18 }}>
            {res.results.map((r, i) => (
              <li key={i}>{r.date} · {r.title} : {LABEL[r.outcome] ?? r.outcome}{r.where ? ` (${r.where})` : ""}{r.reason ? ` — ${r.reason}` : ""}</li>
            ))}
          </ul>
        ) : (
          <p className="mda-sub" style={{ margin: 0 }}>Aucun enregistrement « Newval » dans Veo pour l&apos;instant.</p>
        )
      ) : null}
    </div>
  );
}

function VeoAccount({ status }: { status: { email: string; club: string | null; updatedAt: string | null } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(!status);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
      <p className="mda-sub" style={{ margin: 0 }}>
        Compte Veo enregistré : {status?.email}
        {status?.updatedAt ? ` (depuis le ${new Date(status.updatedAt).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })})` : ""}.{" "}
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(true)}>Changer</button>
      </p>
      <VeoSync />
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <p className="mda-sub" style={{ margin: 0 }}>Le courriel et le mot de passe de ton compte Veo, tapés par toi. Le mot de passe est gardé chiffré et n&apos;est jamais réaffiché.</p>
      <input className="admin-input" placeholder="Courriel Veo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      <input className="admin-input" placeholder="Mot de passe Veo" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      <div>
        <button
          type="button"
          className="admin-btn-primary"
          disabled={busy || !email || !password}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await post({ action: "veo", email, password, club: "anoble-76395aca" });
              setPassword("");
              setOpen(false);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
        >
          Enregistrer le compte Veo
        </button>
      </div>
      {error ? <p className="mda-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>{error}</p> : null}
    </div>
  );
}

export function MatchVideosAdmin({ configured, videos, matches, practices, veo }: { configured: boolean; videos: AdminVideoRow[]; matches: FilmableMatch[]; practices: FilmablePractice[]; veo: { email: string; club: string | null; updatedAt: string | null } | null }) {
  const router = useRouter();
  const pending = videos.some((v) => v.status === "importation" || v.status === "traitement");
  return (
    <>
      <section className="mda-card">
        <h2 className="mda-h2" style={{ marginTop: 0 }}>{configured ? "Ajouter un match ou une pratique filmée" : "Brancher l'hébergement vidéo (une seule fois)"}</h2>
        {configured ? <AddVideo matches={matches} practices={practices} /> : <Connect />}
      </section>
      <section className="mda-card">
        <h2 className="mda-h2" style={{ marginTop: 0 }}>Compte Veo</h2>
        <VeoAccount status={veo} />
      </section>
      <section className="mda-card-flush">
        <div className="mda-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <h2 className="mda-h2">Matchs filmés</h2>
          {pending ? (
            <button type="button" className="admin-btn-ghost" onClick={async () => { await post({ action: "refresh" }).catch(() => null); router.refresh(); }}>
              Actualiser l&apos;état
            </button>
          ) : null}
        </div>
        {videos.length ? (
          <ul className="mda-tasks">
            {videos.map((v) => (
              <VideoRow key={v.id} v={v} />
            ))}
          </ul>
        ) : (
          <p style={{ padding: "14px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>Aucun match filmé pour l&apos;instant.</p>
        )}
      </section>
    </>
  );
}

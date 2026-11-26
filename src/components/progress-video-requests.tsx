"use client";

import { Check, Play, RotateCcw, Trash2, Upload, UserX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Pill } from "@/components/mandalart/ui";
import { CHECKPOINTS, checkpointLabel, groupByDay, summaryLabel, type Checkpoint, type RequestSummary } from "@/lib/progress-videos";
import type { PlayerVideoFiche, RequestDay, RequestPlayer } from "@/lib/progress-videos-repo";

/** Demandes de vidéos du jour et fiche vidéo d'une joueuse (JP, 25 nov. 2026), partagées par l'admin et le portail du
 *  vidéaste. Chaque vidéo part directement du téléphone au stockage privé (lien signé), une à la fois par fille. */

const post = async (endpoint: string, body: Record<string, unknown>) => {
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const json = res ? await res.json().catch(() => null) : null;
  return { ok: !!res?.ok, status: res?.status ?? 0, json };
};

class FatalUpload extends Error {}

function putFile(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "video/mp4");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 413 || /too large|EntityTooLarge|maximum allowed size/i.test(xhr.responseText)) return reject(new FatalUpload("Vidéo trop lourde (50 Mo au plus) : garde une capsule courte ou exporte-la en 720p."));
      reject(new Error("L'envoi n'a pas fonctionné."));
    };
    xhr.onerror = () => reject(new Error("La connexion a coupé pendant l'envoi."));
    xhr.send(file);
  });
}

const waitOnline = () =>
  new Promise<void>((resolve) => {
    if (typeof navigator === "undefined" || navigator.onLine) return setTimeout(resolve, 2500);
    const on = () => {
      window.removeEventListener("online", on);
      setTimeout(resolve, 1000);
    };
    window.addEventListener("online", on);
  });

export interface UploadMeta {
  checkpoint: Checkpoint | null;
  title: string;
  activityId?: string;
  filmedOn?: string;
}

/** Envoie une vidéo et la relie à la fille ; reprend toute seule jusqu'à 3 fois si le réseau coupe. */
async function uploadOne(endpoint: string, registrationId: string, file: File, meta: UploadMeta, onProgress: (p: number) => void, onRetry: (n: number) => void): Promise<void> {
  if (file.type && !/^video\//i.test(file.type)) throw new FatalUpload("Ce fichier n'est pas une vidéo.");
  let last: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const start = await post(endpoint, { action: "depot", registrationId, fileName: file.name, contentType: file.type || "video/mp4" });
      if (!start.ok) {
        if (start.status && start.status < 500) throw new FatalUpload(start.json?.error ?? "Dépôt impossible.");
        throw new Error("Le site ne répond pas.");
      }
      await putFile(start.json.signedUrl, file, onProgress);
      const done = await post(endpoint, { action: "relier", registrationId, path: start.json.path, fileName: file.name, checkpoint: meta.checkpoint, title: meta.title, activityId: meta.activityId, filmedOn: meta.filmedOn });
      if (!done.ok) throw new Error(done.json?.error ?? "La vidéo n'a pas été reliée.");
      return;
    } catch (e) {
      if (e instanceof FatalUpload) throw e;
      last = e;
      if (attempt < 3) {
        onRetry(attempt);
        await waitOnline();
      }
    }
  }
  throw last instanceof Error ? last : new Error("Envoi impossible.");
}

interface QueueItem { key: string; file: File; progress: number; state: "attente" | "envoi" | "fait" | "erreur"; error?: string; retry?: number }

/** Bouton « Ajouter des vidéos » : plusieurs fichiers d'un coup, une barre par fichier, reprise si le réseau coupe. */
export function VideoUploadButton({ endpoint, registrationId, name, meta, label = "Ajouter des vidéos", compact = false }: { endpoint: string; registrationId: string; name: string; meta: UploadMeta; label?: string; compact?: boolean }) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const running = useRef(false);
  const metaRef = useRef(meta);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);
  const busy = queue.some((q) => q.state === "attente" || q.state === "envoi");

  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);

  const patch = (key: string, p: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const run = async (items: QueueItem[]) => {
    if (running.current) return;
    running.current = true;
    for (const item of items) {
      patch(item.key, { state: "envoi", progress: 0, error: undefined });
      try {
        await uploadOne(endpoint, registrationId, item.file, metaRef.current, (p) => patch(item.key, { progress: p }), (n) => patch(item.key, { retry: n, progress: 0 }));
        patch(item.key, { state: "fait", progress: 1 });
        router.refresh();
      } catch (e) {
        patch(item.key, { state: "erreur", error: e instanceof Error ? e.message : "Envoi impossible." });
      }
    }
    running.current = false;
  };

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const items: QueueItem[] = [...files].map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, progress: 0, state: "attente" }));
    setQueue((q) => [...q.filter((x) => x.state !== "fait"), ...items]);
    void run(items);
  };

  const retryFailed = () => {
    const failed = queue.filter((q) => q.state === "erreur");
    setQueue((q) => q.map((x) => (x.state === "erreur" ? { ...x, state: "attente", error: undefined, retry: undefined } : x)));
    void run(failed);
  };

  const failed = queue.filter((q) => q.state === "erreur").length;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label className="admin-btn-primary" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: compact ? 36 : 44, padding: compact ? "6px 12px" : "8px 14px", cursor: "pointer", fontSize: "0.88rem", whiteSpace: "nowrap" }} aria-label={`${label} pour ${name}`}>
        <Upload size={16} strokeWidth={1.75} aria-hidden />
        {label}
        <input type="file" accept="video/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>
      {queue.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {queue.map((q) => (
            <li key={q.key} style={{ display: "grid", gap: 3, fontSize: "0.78rem", color: "var(--adm-text-2)" }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{q.file.name}</span>
                <span style={{ color: q.state === "erreur" ? "var(--adm-bad)" : q.state === "fait" ? "var(--adm-good)" : "var(--adm-text-3)", whiteSpace: "nowrap" }}>
                  {q.state === "fait" ? "Déposée" : q.state === "erreur" ? "Échec" : q.state === "attente" ? "En attente" : q.retry ? `Reprise ${q.retry}… ${Math.round(q.progress * 100)} %` : `${Math.round(q.progress * 100)} %`}
                </span>
              </span>
              <span style={{ height: 4, borderRadius: 999, background: "var(--adm-surface-3)", overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${Math.round(q.progress * 100)}%`, background: q.state === "erreur" ? "var(--adm-bad)" : q.state === "fait" ? "var(--adm-good)" : "var(--adm-accent)", transition: "width 0.2s" }} />
              </span>
              {q.error && <span style={{ color: "var(--adm-bad)" }}>{q.error}</span>}
            </li>
          ))}
        </ul>
      )}
      {failed > 0 && !busy && (
        <button type="button" className="admin-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, justifySelf: "start", fontSize: "0.8rem" }} onClick={retryFailed}>
          <RotateCcw size={14} strokeWidth={1.75} aria-hidden /> Réessayer {failed > 1 ? `les ${failed} vidéos` : "la vidéo"}
        </button>
      )}
    </div>
  );
}

/** Lecteur plein écran d'une vidéo (lien signé demandé au besoin). */
function VideoModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-label={label} onClick={onClose} style={{ position: "fixed", inset: 0, background: "color-mix(in srgb, var(--adm-text) 75%, transparent)", display: "grid", placeItems: "center", zIndex: 60, padding: 16 }}>
      <div style={{ display: "grid", gap: 8, justifyItems: "end", width: "min(900px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="admin-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 4 }} onClick={onClose}><X size={16} strokeWidth={1.75} aria-hidden /> Fermer</button>
        <video src={url} controls autoPlay playsInline style={{ width: "100%", maxHeight: "78vh", borderRadius: 12, background: "var(--adm-text)" }} />
      </div>
    </div>
  );
}

const pct = (s: RequestSummary) => (s.total - s.absent > 0 ? Math.round((s.filmed / (s.total - s.absent)) * 100) : 100);
const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const hm = (t: string) => t.replace(":", " h ").replace(/ h 00$/, " h");

function ProgressBar({ s }: { s: RequestSummary }) {
  return (
    <span style={{ display: "block", height: 6, borderRadius: 999, background: "var(--adm-surface-3)", overflow: "hidden" }} aria-hidden>
      <span style={{ display: "block", height: "100%", width: `${pct(s)}%`, background: s.done ? "var(--adm-good)" : "var(--adm-accent)" }} />
    </span>
  );
}

function Avatar({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 999, overflow: "hidden", flex: "0 0 auto", display: "grid", placeItems: "center", background: "var(--adm-accent-soft)", color: "var(--adm-accent)", fontWeight: 700 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : name.charAt(0)}
    </span>
  );
}

function RequestRow({ endpoint, activityId, player, meta, fichePath }: { endpoint: string; activityId: string; player: RequestPlayer; meta: UploadMeta; fichePath: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const absent = player.status === "absente";
  const fromMcs = absent && player.mark !== "absente";
  const toggleAbsent = async () => {
    setBusy(true);
    await post(endpoint, { action: "absente", activityId, registrationId: player.registrationId, absent: !absent });
    setBusy(false);
    router.refresh();
  };
  const n = player.videos.length;
  return (
    <li style={{ display: "grid", gap: 10, padding: "12px 16px", borderTop: "1px solid var(--adm-line)", opacity: absent ? 0.75 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Avatar url={player.photoUrl} name={player.name} />
        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
          <Link href={`${fichePath}/${player.registrationId}`} style={{ fontWeight: 600, color: "var(--adm-text)", textDecoration: "none" }}>{player.name}</Link>
          <div style={{ fontSize: "0.82rem", color: player.status === "filmee" ? "var(--adm-good)" : absent ? "var(--adm-text-3)" : "var(--adm-warn)", display: "flex", alignItems: "center", gap: 4 }}>
            {player.status === "filmee" ? <><Check size={14} strokeWidth={2} aria-hidden /> {n} capsule{n > 1 ? "s" : ""} déposée{n > 1 ? "s" : ""}</> : absent ? (fromMcs ? "Absente (MonClubSportif)" : "Absente ce jour-là") : "À filmer"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
          <VideoUploadButton endpoint={endpoint} registrationId={player.registrationId} name={player.name} meta={meta} label={n ? "Ajouter" : "Ajouter des vidéos"} />
          {n === 0 && (
            <button type="button" className="admin-btn-ghost" disabled={busy} aria-pressed={absent} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }} onClick={toggleAbsent}>
              {absent ? <><RotateCcw size={16} strokeWidth={1.75} aria-hidden /> Pas absente</> : <><UserX size={16} strokeWidth={1.75} aria-hidden /> Absente ce jour-là</>}
            </button>
          )}
        </div>
      </div>
      {n > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 56 }}>
          {player.videos.map((v, i) => (
            <button key={v.id} type="button" className="admin-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.8rem", padding: "4px 10px" }} onClick={async () => { const r = await post(endpoint, { action: "voir", id: v.id }); if (r.json?.url) setPreview({ url: r.json.url, label: `${player.name}, ${v.title}` }); }}>
              <Play size={13} strokeWidth={1.75} aria-hidden /> {i + 1}. {v.title}{v.checkpoint ? ` · ${checkpointLabel(v.checkpoint)}` : ""}
            </button>
          ))}
        </div>
      )}
      {preview && <VideoModal url={preview.url} label={preview.label} onClose={() => setPreview(null)} />}
    </li>
  );
}

function ActivityCard({ endpoint, activity, fichePath }: { endpoint: string; activity: RequestDay["activities"][number]; fichePath: string }) {
  const [title, setTitle] = useState("Ball mastery");
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(activity.defaultCheckpoint);
  const [onlyLeft, setOnlyLeft] = useState(false);
  const meta: UploadMeta = { checkpoint, title, activityId: activity.activityId };
  const s = activity.summary;
  const players = onlyLeft ? activity.players.filter((p) => p.status === "a-filmer") : activity.players;
  return (
    <section className="mda-card-flush">
      <div className="mda-card-head" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h2 className="mda-h2" style={{ textTransform: "none" }}>{activity.title} · {hm(activity.start)}{activity.end ? ` à ${hm(activity.end)}` : ""}</h2>
            {activity.location && <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--adm-text-3)" }}>{activity.location}</p>}
          </div>
          <Pill tone={s.done ? "good" : s.filmed ? "accent" : "warn"}>{summaryLabel(s)}</Pill>
        </div>
        <ProgressBar s={s} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: "0.8rem", color: "var(--adm-text-2)", flex: "1 1 160px", minWidth: 0 }}>
            Exercice filmé
            <input className="admin-input" style={{ width: "100%" }} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.8rem", color: "var(--adm-text-2)", flex: "1 1 160px", minWidth: 0 }}>
            Étape de la saison (facultatif)
            <select className="admin-input" style={{ width: "100%" }} value={checkpoint ?? ""} onChange={(e) => setCheckpoint((e.target.value || null) as Checkpoint | null)}>
              <option value="">Aucune (capsule du jour)</option>
              {CHECKPOINTS.map((c) => <option key={c.key} value={c.key}>{c.label} (avant / après des familles)</option>)}
            </select>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", color: "var(--adm-text-2)", minHeight: 40 }}>
            <input type="checkbox" checked={onlyLeft} onChange={(e) => setOnlyLeft(e.target.checked)} /> Seulement les filles à filmer
          </label>
        </div>
      </div>
      {players.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {players.map((p) => <RequestRow key={p.registrationId} endpoint={endpoint} activityId={activity.activityId} player={p} meta={meta} fichePath={fichePath} />)}
        </ul>
      ) : (
        <p style={{ margin: 0, padding: 16, color: "var(--adm-text-3)", fontSize: "0.9rem" }}>{activity.players.length ? "Toutes les filles de ce groupe sont filmées ou absentes." : "Aucune fille inscrite trouvée pour ce groupe."}</p>
      )}
    </section>
  );
}

/** L'écran « Demandes de vidéos du jour » : les jours de pratique (pastilles), puis chaque groupe et ses filles. */
export function VideoRequestBoard({ endpoint, basePath, fichePath, today, days, current }: { endpoint: string; basePath: string; fichePath: string; today: string; days: { day: string; summary: RequestSummary }[]; current: RequestDay | null }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {days.length > 0 && (
        <nav aria-label="Jours de pratique" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {days.map((d) => {
            const active = d.day === current?.day;
            const future = d.day > today;
            return (
              <Link key={d.day} href={`${basePath}?date=${d.day}`} aria-current={active ? "page" : undefined} style={{ flex: "0 0 auto", display: "grid", gap: 2, padding: "8px 12px", borderRadius: 10, border: `1px solid ${active ? "var(--adm-accent)" : "var(--adm-line)"}`, background: active ? "var(--adm-accent-soft)" : "var(--adm-surface)", color: "var(--adm-text)", textDecoration: "none", minWidth: 96 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{d.day === today ? "Aujourd'hui" : shortDay(d.day)}</span>
                <span style={{ fontSize: "0.75rem", color: d.summary.done ? "var(--adm-good)" : future ? "var(--adm-text-3)" : "var(--adm-warn)" }}>
                  {d.summary.done ? "Tout est fait" : `${d.summary.remaining} à filmer`}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
      {!current ? (
        <div className="mda-card"><p style={{ margin: 0, color: "var(--adm-text-2)" }}>Aucune pratique de filles prévue pour le moment.</p></div>
      ) : (
        <>
          <div className="mda-card" style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--adm-text-3)", textTransform: "capitalize" }}>{longDay(current.day)}</p>
            <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--adm-text)", letterSpacing: "-0.01em" }}>{current.activities.length ? summaryLabel(current.summary) : "Aucune pratique de filles ce jour-là"}</p>
            {current.activities.length > 0 && <ProgressBar s={current.summary} />}
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
              Plusieurs capsules par fille si besoin. Une fille absente : « Absente ce jour-là » (si on dépose sa vidéo plus tard, on voit qu&apos;elle n&apos;était pas là). Les absences de MonClubSportif sont déjà cochées.
            </p>
          </div>
          {current.activities.map((a) => <ActivityCard key={a.activityId} endpoint={endpoint} activity={a} fichePath={fichePath} />)}
        </>
      )}
    </div>
  );
}

/** Fiche vidéo d'une joueuse : toutes ses vidéos, peu importe la date, lecture sur place, étape, ajout et retrait. */
export function PlayerVideoFicheView({ endpoint, fiche, today }: { endpoint: string; fiche: PlayerVideoFiche; today: string }) {
  const router = useRouter();
  const [filmedOn, setFilmedOn] = useState(today);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [title, setTitle] = useState("Ball mastery");
  const groups = groupByDay(fiche.videos);
  const stageOptions = CHECKPOINTS.filter((c) => fiche.checkpoints.includes(c.key));

  const setStage = async (id: string, cp: string) => {
    await post(endpoint, { action: "etape", id, checkpoint: cp || null });
    router.refresh();
  };
  const remove = async (id: string, label: string) => {
    if (!confirm(`Retirer la vidéo « ${label} » de ${fiche.name} ? Elle sera effacée.`)) return;
    await post(endpoint, { action: "retirer", id });
    router.refresh();
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="mda-card" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar url={fiche.photoUrl} name={fiche.name} size={64} />
        <div style={{ flex: "1 1 200px" }}>
          <h1 className="mda-h1" style={{ margin: 0 }}>{fiche.name}</h1>
          <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.9rem" }}>
            {fiche.category ? `Née en ${fiche.category} · ` : ""}{fiche.videos.length} vidéo{fiche.videos.length > 1 ? "s" : ""}. Les vidéos d&apos;étape ({stageOptions.map((c) => c.label.toLowerCase()).join(", ")}) vont dans l&apos;avant / après de la famille ; les autres restent à l&apos;interne.
          </p>
        </div>
      </div>

      <section className="mda-card" style={{ display: "grid", gap: 10 }}>
        <h2 className="mda-h2">Ajouter des vidéos</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: 4, fontSize: "0.8rem", color: "var(--adm-text-2)" }}>
            Filmée le
            <input type="date" className="admin-input" value={filmedOn} max={today} onChange={(e) => setFilmedOn(e.target.value || today)} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.8rem", color: "var(--adm-text-2)", flex: "1 1 150px", minWidth: 0 }}>
            Exercice filmé
            <input className="admin-input" style={{ width: "100%" }} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: "0.8rem", color: "var(--adm-text-2)", flex: "1 1 150px", minWidth: 0 }}>
            Étape (facultatif)
            <select className="admin-input" style={{ width: "100%" }} value={checkpoint ?? ""} onChange={(e) => setCheckpoint((e.target.value || null) as Checkpoint | null)}>
              <option value="">Autre</option>
              {stageOptions.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
          <VideoUploadButton endpoint={endpoint} registrationId={fiche.registrationId} name={fiche.name} meta={{ checkpoint, title, filmedOn }} />
        </div>
      </section>

      {groups.length === 0 && <div className="mda-card"><p style={{ margin: 0, color: "var(--adm-text-3)" }}>Aucune vidéo pour le moment.</p></div>}
      {groups.map((g) => (
        <section key={g.day} className="mda-card" style={{ display: "grid", gap: 12 }}>
          <h2 className="mda-h2" style={{ textTransform: "capitalize" }}>{longDay(g.day)} · {g.videos.length} capsule{g.videos.length > 1 ? "s" : ""}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {g.videos.map((v) => (
              <figure key={v.id} style={{ margin: 0, display: "grid", gap: 6 }}>
                {v.url ? <video src={v.url} controls playsInline preload="metadata" style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 10, background: "var(--adm-surface-3)" }} /> : <span style={{ color: "var(--adm-text-3)", fontSize: "0.85rem" }}>Vidéo introuvable</span>}
                <figcaption style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: "0.85rem" }}>
                  <span style={{ fontWeight: 600, flex: "1 1 100%" }}>{v.title}{v.uploadedBy ? <span style={{ fontWeight: 400, color: "var(--adm-text-3)" }}> · {v.uploadedBy}</span> : null}</span>
                  <select className="admin-input" aria-label={`Étape de la vidéo ${v.title}`} style={{ flex: "1 1 120px", fontSize: "0.8rem" }} value={v.checkpoint ?? ""} onChange={(e) => void setStage(v.id, e.target.value)}>
                    <option value="">Autre</option>
                    {stageOptions.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <button type="button" className="admin-btn-ghost" aria-label={`Retirer la vidéo ${v.title}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }} onClick={() => void remove(v.id, v.title)}>
                    <Trash2 size={14} strokeWidth={1.75} aria-hidden /> Retirer
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Composants de l'admin du Valkyria Lab : actions (liens, envois), éditeur de la routine du mois,
 *  lecture d'une vidéo reçue par lien signé de 10 minutes et commentaire pour la famille. */

const API = "/api/admin/valkyria-lab";

async function post(body: Record<string, unknown>) {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

const DONE = {
  synced: (r: any) =>
    [r.created ? `${plural(r.created, "lien créé", "liens créés")}` : "Aucune nouvelle famille", r.updated ? `${plural(r.updated, "famille mise à jour", "familles mises à jour")}` : null, r.deactivated ? `${plural(r.deactivated, "lien désactivé", "liens désactivés")} (plus inscrites)` : null]
      .filter(Boolean)
      .join(" · ") + ".",
  sent: (r: any) => (r.sent || r.failed ? `${plural(r.sent, "courriel envoyé", "courriels envoyés")}${r.failed ? ` · ${r.failed} en échec` : ""}.` : "Aucune famille à qui envoyer."),
  saved: () => "Enregistré."
};

const msgStyle = (ok: boolean): React.CSSProperties => ({ fontSize: "0.8rem", color: ok ? "var(--adm-good)" : "var(--adm-bad)", lineHeight: 1.4 });

/** Bouton d'action : confirmation facultative, message de résultat, rafraîchissement de la page. */
export function LabAction({
  body,
  label,
  confirmText,
  primary,
  done,
  small,
  disabled
}: {
  body: Record<string, unknown>;
  label: string;
  confirmText?: string;
  primary?: boolean;
  done?: keyof typeof DONE;
  small?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <button
        type="button"
        className={primary ? "admin-btn-primary" : "admin-btn-ghost"}
        style={{ minHeight: small ? 36 : 44 }}
        disabled={busy || disabled}
        onClick={async () => {
          if (confirmText && !confirm(confirmText)) return;
          setBusy(true);
          setMsg(null);
          try {
            const r = await post(body);
            setMsg(done ? { ok: true, text: DONE[done](r) } : null);
            router.refresh();
          } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Un instant…" : label}
      </button>
      {msg ? <span style={msgStyle(msg.ok)}>{msg.text}</span> : null}
    </span>
  );
}

export function CopyLink({ url, label = "Copier le lien" }: { url: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="mda-task-more" style={{ minHeight: 44 }} onClick={() => navigator.clipboard.writeText(url).then(() => setOk(true))}>
      {ok ? "Lien copié ✓" : label}
    </button>
  );
}

// ─────────────────────────── Vidéo reçue ───────────────────────────

export interface VideoCardData {
  id: string;
  player: string;
  gesture: string;
  family: string | null;
  receivedLabel: string;
  sizeLabel: string | null;
  fileName: string;
  status: "a_voir" | "vu";
  comment: string | null;
  notified: boolean;
  seenLabel: string | null;
}

/** Une vidéo : la regarder (lien signé de 10 minutes demandé au moment du clic), puis la marquer vue avec un commentaire. */
export function VideoCard({ v, commentMax }: { v: VideoCardData; commentMax: number }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [playError, setPlayError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState(v.comment ?? "");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const watch = async () => {
    setLoading(true);
    setMsg(null);
    setPlayError(false);
    try {
      const r = await post({ action: "watch", id: v.id });
      setUrl(r.url);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setLoading(false);
    }
  };
  const open = async (download: boolean) => {
    try {
      const r = await post({ action: "watch", id: v.id, download });
      window.open(r.url, "_blank", "noopener");
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    }
  };
  const act = async (body: Record<string, unknown>, after?: (r: any) => string | null) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await post(body);
      const text = after ? after(r) : null;
      if (text) setMsg({ ok: true, text });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li id={`v-${v.id}`} className="mda-task" style={{ display: "block", scrollMarginTop: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <p className="mda-task-title" style={{ fontWeight: 600 }}>
            {v.player} · {v.gesture}
          </p>
          <div className="mda-task-meta">
            <span>{v.receivedLabel}</span>
            {v.family ? <span>Famille {v.family}</span> : null}
            {v.sizeLabel ? <span>{v.sizeLabel}</span> : null}
            {v.status === "vu" && v.seenLabel ? <span style={{ color: "var(--adm-good)" }}>Vue {v.seenLabel}{v.notified ? " · commentaire envoyé à la famille" : ""}</span> : null}
          </div>
        </div>
        {!url ? (
          <button type="button" className={v.status === "a_voir" ? "admin-btn-primary" : "admin-btn-ghost"} style={{ minHeight: 44 }} disabled={loading} onClick={watch}>
            {loading ? "Un instant…" : "▶ Regarder"}
          </button>
        ) : null}
      </div>

      {url ? (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <video
            src={url}
            controls
            playsInline
            autoPlay
            preload="metadata"
            onError={() => setPlayError(true)}
            style={{ width: "100%", maxHeight: "70vh", background: "#000", borderRadius: "var(--adm-radius-sm)" }}
          />
          {playError ? (
            <p style={{ ...msgStyle(false), margin: 0 }}>
              Cette vidéo ne joue pas dans ce navigateur (format iPhone HEVC, souvent). Ouvrez-la dans Safari ou téléchargez-la.
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.78rem", color: "var(--adm-text-3)" }}>
            <span>Lien privé valable 10 minutes · {v.fileName}</span>
            <button type="button" className="mda-task-more" onClick={() => open(false)}>
              Ouvrir dans un onglet
            </button>
            <button type="button" className="mda-task-more" onClick={() => open(true)}>
              Télécharger
            </button>
          </div>
        </div>
      ) : null}

      {v.status === "vu" && v.comment ? (
        <p style={{ margin: "10px 0 0", padding: "10px 12px", background: "var(--adm-surface-2)", borderRadius: "var(--adm-radius-sm)", fontSize: "0.88rem", color: "var(--adm-text-2)" }}>« {v.comment} »</p>
      ) : null}

      {v.status === "a_voir" ? (
        <form
          style={{ display: "grid", gap: 8, marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            const text = comment.trim();
            void act({ action: "mark-seen", id: v.id, comment: text || null, notify: notify && !!text }, (r) => (r.notified ? "Vue · commentaire envoyé à la famille." : null));
          }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: "0.8rem", color: "var(--adm-text-2)" }}>Commentaire pour la famille (facultatif)</span>
            <textarea
              className="admin-input"
              rows={2}
              maxLength={commentMax}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex. Belle semelle ! Garde le ballon plus près du pied et lève la tête."
              style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
            />
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: "0.82rem", color: comment.trim() ? "var(--adm-text-2)" : "var(--adm-text-3)", minHeight: 44 }}>
              <input type="checkbox" checked={notify && !!comment.trim()} disabled={!comment.trim()} onChange={(e) => setNotify(e.target.checked)} style={{ width: 18, height: 18 }} />
              Envoyer le commentaire à la famille par courriel
            </label>
            <span style={{ fontSize: "0.75rem", color: "var(--adm-text-3)" }} className="mda-tnum">
              {comment.length}/{commentMax}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="admin-btn-ghost" style={{ minHeight: 44 }} disabled={busy}>
              {busy ? "Un instant…" : "Marquer vue"}
            </button>
            <button
              type="button"
              className="mda-task-more"
              disabled={busy}
              onClick={() => {
                if (confirm(`Supprimer définitivement la vidéo « ${v.gesture} » de ${v.player} ? La famille ne la verra plus dans sa liste.`)) void act({ action: "delete-video", id: v.id });
              }}
            >
              Supprimer la vidéo
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <button type="button" className="mda-task-more" disabled={busy} onClick={() => act({ action: "mark-unseen", id: v.id })}>
            Remettre à voir
          </button>
          <button
            type="button"
            className="mda-task-more"
            disabled={busy}
            onClick={() => {
              if (confirm(`Supprimer définitivement la vidéo « ${v.gesture} » de ${v.player} ?`)) void act({ action: "delete-video", id: v.id });
            }}
          >
            Supprimer
          </button>
        </div>
      )}
      {msg ? <p style={{ ...msgStyle(msg.ok), margin: "8px 0 0" }}>{msg.text}</p> : null}
    </li>
  );
}

// ─────────────────────────── Éditeur de la routine du mois ───────────────────────────

interface Row {
  name: string;
  how: string;
  videoUrl: string;
}

export interface RoutineDraft {
  title: string;
  instructions: string;
  exercises: Row[];
  challenge: string;
  challengeVideoUrl: string;
  weeklyGames: Row[];
}

const emptyRow = (): Row => ({ name: "", how: "", videoUrl: "" });
const MAX_EXERCISES = 12;
const MAX_GAMES = 5;

const label: React.CSSProperties = { fontSize: "0.8rem", color: "var(--adm-text-2)" };
const field: React.CSSProperties = { width: "100%", fontFamily: "inherit" };
const box: React.CSSProperties = { display: "grid", gap: 8, padding: 12, background: "var(--adm-surface-2)", borderRadius: "var(--adm-radius-sm)" };
const looksLikeVideo = (s: string) => !s.trim() || /^https?:\/\/([a-z]+\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com)\//i.test(s.trim());

function LinkInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ok = looksLikeVideo(value);
  return (
    <span style={{ display: "grid", gap: 4 }}>
      <input className="admin-input" style={field} type="url" inputMode="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Lien YouTube ou Vimeo non répertorié (facultatif)"} />
      {!ok ? <span style={{ fontSize: "0.75rem", color: "var(--adm-warn)" }}>Lien YouTube ou Vimeo seulement.</span> : null}
    </span>
  );
}

export function RoutineEditor({
  month,
  monthTitle,
  routineId,
  status,
  initial,
  prefilledFrom,
  previewHref
}: {
  month: string;
  monthTitle: string;
  routineId: string | null;
  status: "brouillon" | "publie" | null;
  initial: RoutineDraft;
  prefilledFrom: string | null;
  previewHref: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<RoutineDraft>(() => ({
    ...initial,
    exercises: initial.exercises.length ? initial.exercises : [emptyRow(), emptyRow(), emptyRow()],
    weeklyGames: initial.weeklyGames.length ? initial.weeklyGames : [emptyRow(), emptyRow(), emptyRow(), emptyRow()]
  }));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const setRow = (key: "exercises" | "weeklyGames", i: number, patch: Partial<Row>) => setD({ ...d, [key]: d[key].map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const removeRow = (key: "exercises" | "weeklyGames", i: number) => setD({ ...d, [key]: d[key].filter((_, k) => k !== i) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.exercises.length) return;
    const next = [...d.exercises];
    [next[i], next[j]] = [next[j], next[i]];
    setD({ ...d, exercises: next });
  };

  const save = async (publish: boolean | null, key: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await post({
        action: "save-routine",
        publish,
        routine: {
          month,
          title: d.title,
          instructions: d.instructions || null,
          exercises: d.exercises.map((e) => ({ name: e.name, how: e.how || null, videoUrl: e.videoUrl || null })),
          challenge: d.challenge || null,
          challengeVideoUrl: d.challengeVideoUrl || null,
          weeklyGames: d.weeklyGames.map((g) => ({ title: g.name, how: g.how || null, videoUrl: g.videoUrl || null }))
        }
      });
      setMsg({ ok: true, text: r.status === "publie" ? `Publiée : les familles voient la routine ${monthTitle}.` : "Brouillon enregistré : les familles ne le voient pas encore." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    if (!routineId || !confirm("Retirer la routine de la page des familles ? Elles verront la routine du mois précédent.")) return;
    setBusy("unpublish");
    setMsg(null);
    try {
      await post({ action: "routine-status", id: routineId, status: "brouillon" });
      setMsg({ ok: true, text: "Retirée : c'est maintenant un brouillon." });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!routineId || !confirm(`Supprimer le brouillon ${monthTitle} ?`)) return;
    setBusy("delete");
    try {
      await post({ action: "delete-routine", id: routineId });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <form
      style={{ display: "grid", gap: 24 }}
      onSubmit={(e) => {
        e.preventDefault();
        void save(status === "publie" ? null : true, "main");
      }}
    >
      {prefilledFrom ? (
        <p style={{ margin: 0, padding: "10px 12px", borderRadius: "var(--adm-radius-sm)", background: "var(--adm-info-soft)", color: "var(--adm-info)", fontSize: "0.85rem" }}>
          Prérempli à partir de la routine {prefilledFrom} : gardez ce qui a marché, changez le reste, puis enregistrez.
        </p>
      ) : null}

      <section style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={label}>Titre que les familles voient</span>
          <input className="admin-input" style={field} value={d.title} maxLength={120} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder={`Routine maison ${monthTitle}`} required />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={label}>Consignes (combien de fois par semaine, combien de temps, matériel)</span>
          <textarea
            className="admin-input"
            style={{ ...field, resize: "vertical" }}
            rows={3}
            maxLength={2000}
            value={d.instructions}
            onChange={(e) => setD({ ...d, instructions: e.target.value })}
            placeholder="Ex. 10 minutes, 3 fois par semaine, un ballon et un petit espace. Suivez les gestes dans l'ordre."
          />
        </label>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 className="mda-h2" style={{ fontSize: "1rem" }}>Gestes de la routine</h3>
          <p className="mda-sub" style={{ margin: 0 }}>Chaque geste a sa démonstration de moins d’une minute. Les familles choisiront ce geste en envoyant leur vidéo.</p>
        </div>
        {d.exercises.map((e, i) => (
          <div key={i} style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--adm-text-3)" }}>Geste {i + 1}</span>
              <span style={{ display: "inline-flex", gap: 12 }}>
                {i > 0 ? (
                  <button type="button" className="mda-task-more" onClick={() => move(i, -1)} aria-label={`Monter le geste ${i + 1}`}>
                    Monter
                  </button>
                ) : null}
                <button type="button" className="mda-task-more" onClick={() => removeRow("exercises", i)}>
                  Retirer
                </button>
              </span>
            </div>
            <input className="admin-input" style={field} maxLength={60} value={e.name} onChange={(ev) => setRow("exercises", i, { name: ev.target.value })} placeholder="Nom du geste (ex. Semelle)" />
            <textarea className="admin-input" style={{ ...field, resize: "vertical" }} rows={2} maxLength={600} value={e.how} onChange={(ev) => setRow("exercises", i, { how: ev.target.value })} placeholder="Comment faire (ex. 3 x 30 secondes, chaque pied)" />
            <LinkInput value={e.videoUrl} onChange={(v) => setRow("exercises", i, { videoUrl: v })} />
          </div>
        ))}
        {d.exercises.length < MAX_EXERCISES ? (
          <div>
            <button type="button" className="admin-btn-ghost" style={{ minHeight: 44 }} onClick={() => setD({ ...d, exercises: [...d.exercises, emptyRow()] })}>
              + Ajouter un geste
            </button>
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 className="mda-h2" style={{ fontSize: "1rem" }}>Défi du mois</h3>
          <p className="mda-sub" style={{ margin: 0 }}>Le défi que les filles filment et envoient (« {`Défi du mois`} » dans le choix du geste).</p>
        </div>
        <div style={box}>
          <textarea className="admin-input" style={{ ...field, resize: "vertical" }} rows={2} maxLength={600} value={d.challenge} onChange={(e) => setD({ ...d, challenge: e.target.value })} placeholder="Ex. 20 jongles pied faible sans que le ballon touche le sol" />
          <LinkInput value={d.challengeVideoUrl} onChange={(v) => setD({ ...d, challengeVideoUrl: v })} />
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div>
          <h3 className="mda-h2" style={{ fontSize: "1rem" }}>Jeu de la semaine</h3>
          <p className="mda-sub" style={{ margin: 0 }}>Un jeu à faire en famille, qui change chaque semaine. S’il y a moins de jeux que de semaines, le dernier reste jusqu’à la fin du mois.</p>
        </div>
        {d.weeklyGames.map((g, i) => (
          <div key={i} style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--adm-text-3)" }}>
                Semaine {i + 1} · du {i * 7 + 1} au {i === 4 ? "31" : i * 7 + 7}
              </span>
              <button type="button" className="mda-task-more" onClick={() => removeRow("weeklyGames", i)}>
                Retirer
              </button>
            </div>
            <input className="admin-input" style={field} maxLength={80} value={g.name} onChange={(ev) => setRow("weeklyGames", i, { name: ev.target.value })} placeholder="Nom du jeu (ex. Le miroir)" />
            <textarea className="admin-input" style={{ ...field, resize: "vertical" }} rows={2} maxLength={600} value={g.how} onChange={(ev) => setRow("weeklyGames", i, { how: ev.target.value })} placeholder="Règles en deux phrases" />
            <LinkInput value={g.videoUrl} onChange={(v) => setRow("weeklyGames", i, { videoUrl: v })} />
          </div>
        ))}
        {d.weeklyGames.length < MAX_GAMES ? (
          <div>
            <button type="button" className="admin-btn-ghost" style={{ minHeight: 44 }} onClick={() => setD({ ...d, weeklyGames: [...d.weeklyGames, emptyRow()] })}>
              + Ajouter une semaine
            </button>
          </div>
        ) : null}
      </section>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--adm-line)" }}>
        <button className="admin-btn-primary" style={{ minHeight: 44 }} disabled={!!busy}>
          {busy === "main" ? "Un instant…" : status === "publie" ? "Enregistrer les changements" : "Publier pour les familles"}
        </button>
        {status !== "publie" ? (
          <button type="button" className="admin-btn-ghost" style={{ minHeight: 44 }} disabled={!!busy} onClick={() => save(false, "draft")}>
            {busy === "draft" ? "Un instant…" : "Enregistrer le brouillon"}
          </button>
        ) : (
          <button type="button" className="admin-btn-ghost" style={{ minHeight: 44 }} disabled={!!busy} onClick={unpublish}>
            {busy === "unpublish" ? "Un instant…" : "Retirer de la page des familles"}
          </button>
        )}
        {routineId ? (
          <a href={previewHref} target="_blank" rel="noreferrer" className="mda-task-more" style={{ padding: "12px 4px" }}>
            Voir comme une famille
          </a>
        ) : null}
        {routineId && status === "brouillon" ? (
          <button type="button" className="mda-task-more" disabled={!!busy} onClick={remove} style={{ padding: "12px 4px" }}>
            Supprimer le brouillon
          </button>
        ) : null}
      </div>
      {msg ? <p style={{ ...msgStyle(msg.ok), margin: 0 }}>{msg.text}</p> : null}
    </form>
  );
}

// ─────────────────────────── Envoi du lien à une famille ───────────────────────────

export function SendLinkButton({ id, email, already }: { id: string; email: string; already: boolean }) {
  return (
    <LabAction
      small
      body={{ action: "send-links", scope: "ids", ids: [id] }}
      label={already ? "Renvoyer" : "Envoyer le lien"}
      confirmText={`${already ? "Renvoyer" : "Envoyer"} le lien du Valkyria Lab à ${email} ?`}
      done="sent"
    />
  );
}

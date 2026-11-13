"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ANGLES, DEFAULT_FILMER, POST_KINDS, postKindLabel } from "@/lib/content-core";
import { NETWORKS } from "@/lib/marketing-posts-core";
import { missingForShoot, nextStatus, PLAN_STEPS, SERIES, SHOOT_STATUS, seriesOf, statusLabel, type Shoot } from "@/lib/video-shoots-core";

/** Tournages : planifier la vidéo du lendemain, puis tourné → monté → publié. Servent à l'espace JP (Mes tournages,
 *  /api/admin/moi) et à l'espace Contenu (calendrier de publication, /api/admin/contenu) : `endpoint` choisit la route. */

async function post(body: Record<string, unknown>, endpoint = "/api/admin/moi") {
  const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur d'enregistrement");
  return json;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DOW = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const shortDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

const label: React.CSSProperties = { fontSize: "0.78rem", color: "var(--adm-text-2)", display: "grid", gap: 4 };

export function ShootForm({ shoot, defaultDate, onClose, endpoint, calendar = false }: { shoot?: Shoot; defaultDate?: string; onClose?: () => void; endpoint?: string; calendar?: boolean }) {
  const { busy, error, run } = useAction();
  const [f, setF] = useState({
    title: shoot?.title ?? "",
    series: shoot?.series ?? "reseaux",
    shootOn: shoot?.shoot_on ?? defaultDate ?? "",
    shootTime: shoot?.shoot_time ?? "",
    place: shoot?.place ?? "",
    message: shoot?.message ?? "",
    hook: shoot?.hook ?? "",
    shots: shoot?.shots ?? "",
    people: shoot?.people ?? "",
    gear: shoot?.gear ?? "",
    format: shoot?.format ?? "Reel 30-45 s",
    note: shoot?.note ?? "",
    publishOn: shoot?.publish_on ?? "",
    postKind: shoot?.post_kind ?? "organique",
    angle: shoot?.angle ?? "",
    networks: (shoot?.networks ?? ["instagram", "facebook"]) as string[],
    filmedBy: shoot?.filmed_by ?? (calendar ? DEFAULT_FILMER : "")
  });
  const showCalendar = calendar || !!shoot?.publish_on;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const save = () =>
    run(() =>
      post({
        action: "shoot-save",
        id: shoot?.id,
        ...f,
        shootOn: f.shootOn || null,
        publishOn: f.publishOn || null,
        filmedBy: f.filmedBy || null,
        // Une vidéo déjà tournée garde son étape ; une idée qui reçoit un jour devient « planifiée ».
        status: shoot && shoot.status !== "idee" ? shoot.status : f.shootOn ? "planifie" : "idee"
      }, endpoint)
    ).then((ok) => {
      if (!ok) return;
      if (onClose) onClose();
      else setF({ ...f, title: "", message: "", hook: "", shots: "", people: "", note: "" });
    });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <label style={{ ...label, gridColumn: "1 / -1" }}>
          Titre de la vidéo
          <input className="admin-input" placeholder="Ex. Ce qui nous distingue d'un club" value={f.title} onChange={set("title")} />
        </label>
        <label style={label}>
          Série
          <select className="admin-input" value={f.series} onChange={set("series")}>
            {SERIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.label}
              </option>
            ))}
          </select>
        </label>
        <label style={label}>
          Jour du tournage
          <input className="admin-input" type="date" value={f.shootOn} onChange={set("shootOn")} />
        </label>
        <label style={label}>
          Heure
          <input className="admin-input" placeholder="7 h 30" value={f.shootTime} onChange={set("shootTime")} />
        </label>
        <label style={label}>
          Lieu
          <input className="admin-input" placeholder="Synthétique de Blainville" value={f.place} onChange={set("place")} />
        </label>
      </div>
      <label style={label}>
        Le message en une phrase (ce qu&apos;un parent doit retenir)
        <input className="admin-input" value={f.message} onChange={set("message")} />
      </label>
      <label style={label}>
        L&apos;accroche des 3 premières secondes (une question ou un résultat)
        <input className="admin-input" placeholder="« Votre fille touche le ballon combien de fois par pratique ? »" value={f.hook} onChange={set("hook")} />
      </label>
      <label style={label}>
        Les plans à filmer (un par ligne)
        <textarea className="admin-input" rows={5} placeholder={"1. Plan large du terrain\n2. Serré sur le ballon\n3. Moi face caméra : le message\n4. Une fille qui réussit le geste\n5. Fin : « Réservez l'évaluation gratuite »"} value={f.shots} onChange={set("shots")} />
      </label>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <label style={label}>
          Qui est dans la vidéo
          <input className="admin-input" placeholder="Moi, un éducateur, 2 joueuses" value={f.people} onChange={set("people")} />
        </label>
        <label style={label}>
          Matériel
          <input className="admin-input" placeholder="Trépied, micro, ballons, batterie chargée" value={f.gear} onChange={set("gear")} />
        </label>
        <label style={label}>
          Format
          <input className="admin-input" value={f.format} onChange={set("format")} />
        </label>
      </div>
      {showCalendar ? (
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", padding: 10, borderRadius: 12, border: "1px dashed var(--adm-line)" }}>
          <label style={label}>
            Publier le
            <input className="admin-input" type="date" value={f.publishOn} onChange={set("publishOn")} />
          </label>
          <label style={label}>
            Type
            <select className="admin-input" value={f.postKind} onChange={set("postKind")}>
              {POST_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label style={label}>
            Angle marketing
            <input className="admin-input" list="content-angles" value={f.angle} onChange={set("angle")} placeholder="Preuve, coulisses, offre…" />
            <datalist id="content-angles">
              {ANGLES.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <label style={label}>
            Qui filme
            <input className="admin-input" value={f.filmedBy} onChange={set("filmedBy")} />
          </label>
          <div style={{ ...label, gridColumn: "1 / -1" }}>
            Réseaux
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {NETWORKS.filter((n) => n.id !== "autre").map((n) => (
                <label key={n.id} style={{ display: "flex", gap: 4, alignItems: "center", color: "var(--adm-text)" }}>
                  <input type="checkbox" checked={f.networks.includes(n.id)} onChange={(e) => setF({ ...f, networks: e.target.checked ? [...f.networks, n.id] : f.networks.filter((x) => x !== n.id) })} />
                  {n.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <label style={label}>
        Note (idées de montage, musique, texte à l&apos;écran)
        <textarea className="admin-input" rows={2} value={f.note} onChange={set("note")} />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="admin-btn-primary" disabled={busy || f.title.trim().length < 2} onClick={save}>
          {shoot ? "Enregistrer" : f.shootOn ? "Planifier ce tournage" : "Garder comme idée"}
        </button>
        {onClose ? (
          <button type="button" className="admin-btn-ghost" onClick={onClose}>
            Fermer
          </button>
        ) : null}
      </div>
      {error ? <p style={{ fontSize: "0.8rem", color: "var(--adm-bad)", margin: 0 }}>{error}</p> : null}
    </div>
  );
}

/** Une vidéo : tout le plan lisible d'un coup d'œil, et le bouton de l'étape suivante. */
export function ShootCard({ s, tomorrow, open = false, endpoint, calendar = false }: { s: Shoot; tomorrow: string; open?: boolean; endpoint?: string; calendar?: boolean }) {
  const { busy, error, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const serie = seriesOf(s.series);
  const next = nextStatus(s.status);
  const missing = s.status === "planifie" ? missingForShoot(s) : [];
  const stepLabel = SHOOT_STATUS.find((x) => x.id === s.status)?.next;
  if (editing || planning) {
    return (
      <div className="mda-card" style={{ margin: 0 }}>
        <ShootForm shoot={s} defaultDate={planning ? tomorrow : undefined} onClose={() => (setEditing(false), setPlanning(false))} endpoint={endpoint} calendar={calendar} />
      </div>
    );
  }
  const line = (title: string, v: string | null) =>
    v ? (
      <div style={{ fontSize: "0.86rem", lineHeight: 1.5 }}>
        <span style={{ color: "var(--adm-text-3)" }}>{title} : </span>
        <span style={{ whiteSpace: "pre-line", color: "var(--adm-text)" }}>{v}</span>
      </div>
    ) : null;
  return (
    <details open={open} style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: 14, padding: "12px 14px" }}>
      <summary style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "0.95rem", color: "var(--adm-text)" }}>
          {serie.emoji} {s.title}
        </strong>
        <span style={{ fontSize: "0.76rem", color: "var(--adm-text-3)" }}>
          {statusLabel(s.status)}
          {s.shoot_on ? ` · ${shortDate(s.shoot_on)}` : ""}
          {s.shoot_time ? ` · ${s.shoot_time}` : ""}
          {s.place ? ` · ${s.place}` : ""}
          {s.publish_on ? ` · publication ${shortDate(s.publish_on)} (${postKindLabel(s.post_kind)})` : ""}
          {s.filmed_by ? ` · filmé par ${s.filmed_by}` : ""}
        </span>
      </summary>
      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
        {line("Message", s.message)}
        {line("Accroche", s.hook)}
        {line("Plans", s.shots)}
        {line("Qui", s.people)}
        {line("Matériel", s.gear)}
        {line("Format", s.format)}
        {line("Angle", s.angle ?? null)}
        {line("Note", s.note)}
        {missing.length ? <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--adm-warn)" }}>À écrire avant de tourner : {missing.join(", ")}.</p> : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {s.status === "idee" ? (
            <button type="button" className="admin-btn-primary" onClick={() => setPlanning(true)}>
              Planifier pour demain
            </button>
          ) : next && stepLabel ? (
            <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => run(() => post({ action: "shoot-status", id: s.id, status: next }, endpoint))}>
              {stepLabel}
            </button>
          ) : null}
          <button type="button" className="admin-btn-ghost" onClick={() => setEditing(true)}>
            Modifier le plan
          </button>
          <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => confirm("Effacer cette vidéo ?") && run(() => post({ action: "shoot-delete", id: s.id }, endpoint))}>
            Effacer
          </button>
        </div>
        {error ? <p style={{ fontSize: "0.8rem", color: "var(--adm-bad)", margin: 0 }}>{error}</p> : null}
      </div>
    </details>
  );
}

export function PlanSteps() {
  return (
    <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4, fontSize: "0.88rem", lineHeight: 1.5, color: "var(--adm-text)" }}>
      {PLAN_STEPS.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ol>
  );
}

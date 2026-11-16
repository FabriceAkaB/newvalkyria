"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { DocumentViewerModal } from "@/components/admin-entity-documents";
import { VENUES, venueLabel, type Venue } from "@/lib/practice-venue";

/** Toute la saison : chaque pratique de l'Académie jusqu'au 18 avril, avec son espace (gym double, 2/3, synthétique à 7).
 *  On y dépose les diapos en PDF d'avance, on réutilise une pratique déjà déposée, et on la voit en aperçu, comme
 *  l'éducateur assigné la verra dans son portail. */

export interface SeasonRow {
  key: string;
  date: string;
  start: string;
  end: string | null;
  location: string;
  group: string;
  venue: Venue;
  theme: string | null;
  activityId: string | null;
  blocks: number;
  docs: { id: string; fileName: string; uploadedAt: string }[];
}

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const weekStart = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const hour = (t: string) => t.replace(":", " h ");
const shortPlace = (l: string) => l.split(/[,–-]/)[0].trim();

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/pratiques/depot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Erreur");
  return data;
}

function putFile(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", file.type || "application/pdf");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? "PDF trop lourd (plus de 50 Mo)." : "L'envoi n'a pas fonctionné. Réessayez.")));
    xhr.onerror = () => reject(new Error("La connexion a coupé pendant l'envoi. Réessayez."));
    xhr.send(file);
  });
}

async function openDoc(id: string, fileName: string, set: (v: { fileName: string; signedUrl: string }) => void) {
  const res = await fetch(`/api/admin/documents/${id}/download`);
  const data = await res.json().catch(() => null);
  if (data?.signedUrl) set({ fileName, signedUrl: data.signedUrl });
}

function Row({ p, library, onView }: { p: SeasonRow; library: { id: string; fileName: string }[]; onView: (id: string, name: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const v = venueLabel(p.venue);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy("Envoi…");
    try {
      const start = await api({ action: "start", fileName: file.name, contentType: file.type });
      await putFile(start.signedUrl, file, (x) => setBusy(`Envoi ${Math.round(x * 100)} %`));
      setBusy("Rangement…");
      await api({ key: p.key, path: start.path, fileName: file.name });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };
  const reuse = async (id: string) => {
    if (!id) return;
    setError(null);
    setBusy("Rangement…");
    try {
      await api({ key: p.key, reuseDocumentId: id });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };
  const remove = async (id: string, name: string) => {
    if (!confirm(`Retirer « ${name} » de cette pratique ?`)) return;
    setBusy("Retrait…");
    await fetch(`/api/admin/documents/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    router.refresh();
  };

  const ready = p.docs.length > 0;
  return (
    <li className="mda-task" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
      <span className="mda-dot" style={{ background: ready ? "var(--adm-good)" : "var(--adm-text-3)", width: 10, height: 10, marginTop: 6 }} aria-hidden />
      <div className="mda-task-body" style={{ minWidth: 220 }}>
        <p className="mda-task-title" style={{ fontWeight: 600 }}>
          {dayLabel(p.date)} · {hour(p.start)} · {p.group}
        </p>
        <div className="mda-task-meta">
          <span>
            {v.icon} {v.short}
          </span>
          <span>{shortPlace(p.location)}</span>
          {p.theme ? <span>Thème : {p.theme}</span> : null}
          {p.blocks ? <span style={{ color: "var(--adm-good)" }}>{p.blocks} bloc{p.blocks > 1 ? "s" : ""} dans le plan</span> : null}
        </div>
        {p.docs.map((d) => (
          <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, fontSize: "0.82rem" }}>
            <button type="button" onClick={() => onView(d.id, d.fileName)} className="admin-btn-ghost" style={{ padding: "4px 10px" }}>
              👁 Aperçu
            </button>
            <span style={{ color: "var(--adm-text-2)", overflow: "hidden", textOverflow: "ellipsis" }}>{d.fileName}</span>
            <button type="button" onClick={() => remove(d.id, d.fileName)} title="Retirer" style={{ background: "none", border: "none", color: "var(--adm-bad)", cursor: "pointer" }}>
              ×
            </button>
          </div>
        ))}
        {error ? <p style={{ margin: "6px 0 0", color: "var(--adm-bad)", fontSize: "0.8rem" }}>{error}</p> : null}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
        {busy ? (
          <span style={{ fontSize: "0.82rem", color: "var(--adm-text-2)" }}>{busy}</span>
        ) : (
          <>
            <label className={ready ? "admin-btn-ghost" : "admin-btn-primary"} style={{ padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>
              {ready ? "+ Autre PDF" : "Déposer le PDF"}
              <input type="file" accept="application/pdf,.pdf,image/png,image/jpeg" style={{ display: "none" }} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {library.length && !ready ? (
              <select className="admin-input" style={{ width: "auto", maxWidth: 220 }} value="" onChange={(e) => reuse(e.target.value)}>
                <option value="">Réutiliser une pratique…</option>
                {library.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fileName}
                  </option>
                ))}
              </select>
            ) : null}
            {p.activityId ? (
              <Link href={`/admin/entraineurs/activites/${p.activityId}`} className="admin-btn-ghost" style={{ padding: "6px 10px", textDecoration: "none" }} title="Plan de séance, éducateurs assignés">
                Ouvrir
              </Link>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

export function PracticeSeason({ rows }: { rows: SeasonRow[] }) {
  const [filter, setFilter] = useState<Venue | "toutes">("toutes");
  const [todo, setTodo] = useState(false);
  const [viewing, setViewing] = useState<{ fileName: string; signedUrl: string } | null>(null);

  // Les pratiques déjà déposées, une fois chacune (même fichier réutilisé = une seule entrée).
  const library = useMemo(() => {
    const seen = new Map<string, { id: string; fileName: string }>();
    for (const r of rows) for (const d of r.docs) if (!seen.has(d.fileName)) seen.set(d.fileName, { id: d.id, fileName: d.fileName });
    return [...seen.values()].sort((a, b) => a.fileName.localeCompare(b.fileName, "fr"));
  }, [rows]);

  const shown = rows.filter((r) => (filter === "toutes" || r.venue === filter) && (!todo || r.docs.length === 0));
  const weeks = [...new Set(shown.map((r) => weekStart(r.date)))];
  const venues = VENUES.filter((v) => rows.some((r) => r.venue === v.id));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className={filter === "toutes" ? "admin-btn-primary" : "admin-btn-ghost"} onClick={() => setFilter("toutes")}>
          Toutes ({rows.length})
        </button>
        {venues.map((v) => (
          <button key={v.id} type="button" className={filter === v.id ? "admin-btn-primary" : "admin-btn-ghost"} onClick={() => setFilter(v.id)}>
            {v.icon} {v.short} ({rows.filter((r) => r.venue === v.id).length})
          </button>
        ))}
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem", color: "var(--adm-text-2)", marginLeft: 8 }}>
          <input type="checkbox" checked={todo} onChange={(e) => setTodo(e.target.checked)} /> Seulement celles à monter
        </label>
      </div>

      {weeks.length === 0 ? <p className="mda-sub">Rien à afficher.</p> : null}
      {weeks.map((w) => {
        const list = shown.filter((r) => weekStart(r.date) === w);
        const done = list.filter((r) => r.docs.length).length;
        return (
          <section key={w} className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Semaine du {dayLabel(w)}</h2>
              <span className="mda-sub" style={{ margin: 0, color: done === list.length ? "var(--adm-good)" : undefined }}>
                {done}/{list.length} déposées
              </span>
            </div>
            <ul className="mda-tasks">
              {list.map((r) => (
                <Row key={r.key} p={r} library={library} onView={(id, name) => openDoc(id, name, setViewing)} />
              ))}
            </ul>
          </section>
        );
      })}
      {viewing ? <DocumentViewerModal fileName={viewing.fileName} signedUrl={viewing.signedUrl} onClose={() => setViewing(null)} /> : null}
    </div>
  );
}

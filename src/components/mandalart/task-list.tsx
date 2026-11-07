"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DelegateForm } from "@/components/delegate-form";

type Status = "a_faire" | "en_cours" | "fait" | "abandonne";

export interface TaskItem {
  code: string;
  title: string;
  priority: "star" | "progressive";
  level: number;
  due: string | null;
  owner: string | null;
  links: { id: string; label: string }[];
  status: Status;
  note: string | null;
  evidenceUrl: string | null;
  overdue: boolean;
  objective: string;
  objectiveName: string;
  pillar: string;
  addedOn?: string | null;
  /** Date prévue au départ, si la tâche a été reportée automatiquement. */
  plannedDue?: string | null;
  /** Date fixe : jamais reportée automatiquement. */
  fixed?: boolean;
}

const NEXT: Record<Status, Status> = { a_faire: "en_cours", en_cours: "fait", fait: "a_faire", abandonne: "a_faire" };
const LABEL: Record<Status, string> = { a_faire: "À faire", en_cours: "En cours", fait: "Fait", abandonne: "Abandonnée" };
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
};

async function save(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/mandalart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur d'enregistrement");
  return json;
}

function TaskRow({ t, currentLevel, showObjective }: { t: TaskItem; currentLevel: number; showObjective: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(t.status);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(t.note ?? "");
  const [evidence, setEvidence] = useState(t.evidenceUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fixed, setFixed] = useState(Boolean(t.fixed));
  const [delegating, setDelegating] = useState(false);
  const [owner, setOwner] = useState(t.owner);

  const toggleFixed = async () => {
    setBusy(true);
    setError(null);
    try {
      await save({ action: "fixed", code: t.code, fixed: !fixed });
      setFixed(!fixed);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const apply = async (next: Status, extra?: { note?: string; evidenceUrl?: string }) => {
    const prev = status;
    setStatus(next);
    setBusy(true);
    setError(null);
    try {
      await save({ action: "status", code: t.code, status: next, ...extra });
      router.refresh();
    } catch (err) {
      setStatus(prev);
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const late = t.overdue && (status === "a_faire" || status === "en_cours");
  return (
    <li className="mda-task" data-s={status} data-future={t.level > currentLevel && status !== "fait" ? "true" : undefined}>
      <button
        type="button"
        className="mda-check"
        data-s={status}
        disabled={busy}
        onClick={() => apply(NEXT[status])}
        aria-label={`${LABEL[status]} — toucher pour passer à « ${LABEL[NEXT[status]]} »`}
        title={`${LABEL[status]} → ${LABEL[NEXT[status]]}`}
      >
        <span>{status === "fait" ? "✓" : ""}</span>
      </button>
      <div className="mda-task-body">
        <p className="mda-task-title">
          {t.priority === "star" ? <span aria-label="Priorité absolue" title="Priorité absolue (compte double)">⭐ </span> : null}
          {t.title}
        </p>
        <div className="mda-task-meta">
          <span className="mda-tnum">{t.code}</span>
          <span>N{t.level}</span>
          {t.due ? <span className={late ? "mda-late" : undefined}>{late ? `En retard · ${day(t.due)}` : day(t.due)}</span> : null}
          {t.plannedDue && !fixed ? <span title="Reportée automatiquement : pas faite à sa date">Reportée · prévue le {day(t.plannedDue)}</span> : null}
          {fixed ? <span className="mda-pill" title="Date fixe : jamais reportée">Date fixe</span> : null}
          {owner ? <span title="Responsable">{owner}</span> : null}
          {status === "en_cours" ? <span style={{ color: "var(--adm-warn)" }}>En cours</span> : null}
          {status === "abandonne" ? <span>Abandonnée</span> : null}
          {t.addedOn ? <span title="Ajoutée par JP le 2 nov. 2026">Ajout de JP</span> : null}
          {t.links.map((l) => (
            <Link key={l.id} href="/admin/mandalart/agents" className="mda-pill" style={{ textDecoration: "none" }} title={l.label}>
              {l.id}
            </Link>
          ))}
          {showObjective ? (
            <Link href={`/admin/mandalart/piliers/${t.pillar.toLowerCase()}#${t.objective}`} style={{ color: "var(--adm-text-3)" }}>
              {t.objective} {t.objectiveName}
            </Link>
          ) : null}
          <button type="button" className="mda-task-more" onClick={() => setOpen((o) => !o)}>
            {open ? "Fermer" : t.note || t.evidenceUrl ? "Note ✎" : "Note"}
          </button>
          {status === "a_faire" || status === "en_cours" ? (
            <button type="button" className="mda-task-more" onClick={() => setDelegating((d) => !d)} title="Confier cette tâche à Christine, à Annie, à un éducateur…">
              {delegating ? "Fermer" : "Confier"}
            </button>
          ) : null}
        </div>
        {delegating ? (
          <DelegateForm
            mandalartCode={t.code}
            defaultTitle={t.title}
            defaultDue={t.due}
            onCancel={() => setDelegating(false)}
            onDone={(who) => {
              setOwner(who);
              setDelegating(false);
              router.refresh();
            }}
          />
        ) : null}
        {t.note && !open ? <p style={{ fontSize: "0.8rem", color: "var(--adm-text-2)", margin: "6px 0 0" }}>{t.note}</p> : null}
        {open ? (
          <div className="mda-task-edit">
            <textarea className="admin-input" rows={2} placeholder="Note : ce qui a été fait, ce qui bloque, la décision prise…" value={note} onChange={(e) => setNote(e.target.value)} />
            <input className="admin-input" placeholder="Lien de preuve (document, vidéo, page)" value={evidence} onChange={(e) => setEvidence(e.target.value)} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="admin-btn-primary" disabled={busy} onClick={() => apply(status, { note, evidenceUrl: evidence }).then(() => setOpen(false))}>
                Enregistrer
              </button>
              {(["a_faire", "en_cours", "fait"] as Status[])
                .filter((s) => s !== status)
                .map((s) => (
                  <button key={s} type="button" className="admin-btn-ghost" disabled={busy} onClick={() => apply(s, { note, evidenceUrl: evidence })}>
                    {LABEL[s]}
                  </button>
                ))}
              <button type="button" className="admin-btn-ghost" disabled={busy} onClick={toggleFixed} title="Une tâche à date fixe n'est jamais reportée au lendemain">
                {fixed ? "Retirer la date fixe" : "Date fixe (ne pas reporter)"}
              </button>
              {status !== "abandonne" ? (
                <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => confirm("Abandonner cette tâche ? Elle ne comptera plus dans la progression.") && apply("abandonne", { note, evidenceUrl: evidence })}>
                  Abandonner
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {error ? <p style={{ fontSize: "0.8rem", color: "var(--adm-bad)", margin: "6px 0 0" }}>{error}</p> : null}
      </div>
    </li>
  );
}

/** Liste de tâches cochables : toucher le rond fait passer à faire → en cours → fait. */
export function TaskList({ tasks, currentLevel, showObjective = false, groupByLevel = false, empty }: { tasks: TaskItem[]; currentLevel: number; showObjective?: boolean; groupByLevel?: boolean; empty?: string }) {
  if (tasks.length === 0) return <p style={{ padding: "16px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>{empty ?? "Rien ici."}</p>;
  if (!groupByLevel) {
    return (
      <ul className="mda-tasks">
        {tasks.map((t) => (
          <TaskRow key={t.code} t={t} currentLevel={currentLevel} showObjective={showObjective} />
        ))}
      </ul>
    );
  }
  const levels = [...new Set(tasks.map((t) => t.level))].sort();
  return (
    <ul className="mda-tasks">
      {levels.map((lv, i) => (
        <li key={lv} style={{ listStyle: "none" }}>
          <div className="mda-group-title" style={i === 0 ? { borderTop: "none" } : undefined}>
            Niveau {lv}
            {lv === currentLevel ? " · niveau actuel" : lv > currentLevel ? " · à venir" : ""}
          </div>
          <ul className="mda-tasks">
            {tasks
              .filter((t) => t.level === lv)
              .sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "star" ? -1 : 1))
              .map((t) => (
                <TaskRow key={t.code} t={t} currentLevel={currentLevel} showObjective={showObjective} />
              ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

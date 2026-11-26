"use client";

import { Archive, Award, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, FilePlus2, Footprints, ImageUp, LayoutGrid, LayoutList, ListOrdered, Maximize2, PencilLine, Plus, Search, Shapes, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./exercise-bible.css";

import { ExerciseDiagramView } from "@/components/exercise-diagram";
import { BIBLES, bibleInfo, type BibleKey } from "@/lib/exercise-bank";
import {
  bestExercises,
  bibleChapterOrder,
  bookChapters,
  bookPages,
  chapterStarts,
  jpReferenceExercises,
  matchesGrid,
  pageOfExercise,
  spreadStart,
  turnPage,
  type BookChapter,
  type BookExercise,
  type BookPage
} from "@/lib/exercise-book-core";
import type { ExerciseDiagram } from "@/lib/exercises-repo";

const fr = (n: number | null) => (n === null ? null : n.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));
const PAGE_KEY = "nv-bible-page";
const VIEW_KEY = "nv-bible-vue";
const GRID_KEY = "nv-bible-descriptif";
const GRID_STEP = 16;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Sans diapo ni schéma : un terrain dessiné (joueuses, cônes, ballon) propre à l'exercice, jamais une carte vide. */
function IllustratedPitch({ ex }: { ex: BookExercise }) {
  const h = hash(ex.id);
  const rnd = (i: number) => ((h >>> (i % 24)) ^ (h * (i + 7))) % 1000 / 1000;
  const team = Array.from({ length: 4 }, (_, i) => ({ x: 30 + rnd(i) * 140, y: 18 + rnd(i + 5) * 64 }));
  const opp = Array.from({ length: 3 }, (_, i) => ({ x: 40 + rnd(i + 11) * 120, y: 22 + rnd(i + 17) * 56 }));
  return (
    <svg viewBox="0 0 200 100" className="xbk-pitch" role="img" aria-label={`Illustration : ${ex.title}`}>
      <rect x="1" y="1" width="198" height="98" rx="6" className="xbk-pitch-bg" />
      <rect x="10" y="8" width="180" height="84" rx="2" className="xbk-pitch-line" />
      <line x1="100" y1="8" x2="100" y2="92" className="xbk-pitch-line" />
      <circle cx="100" cy="50" r="12" className="xbk-pitch-line" />
      <rect x="185" y="40" width="5" height="20" className="xbk-pitch-goal" />
      <rect x="10" y="40" width="5" height="20" className="xbk-pitch-goal" />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${24 + i * 50} 84 l3 -6 l3 6 z`} className="xbk-pitch-cone" />)}
      <line x1={team[0].x} y1={team[0].y} x2={team[1].x} y2={team[1].y} className="xbk-pitch-pass" />
      {team.map((p, i) => <circle key={`t${i}`} cx={p.x} cy={p.y} r="4.2" className="xbk-pitch-a" />)}
      {opp.map((p, i) => <circle key={`o${i}`} cx={p.x} cy={p.y} r="4.2" className="xbk-pitch-b" />)}
      <circle cx={team[0].x + 5} cy={team[0].y + 3} r="1.8" className="xbk-pitch-ball" />
    </svg>
  );
}

/** Un geste sans vidéo ni image : deux cônes, le ballon et son trajet en pointillé (pas un terrain : c'est un geste). */
function IllustratedGesture({ ex }: { ex: BookExercise }) {
  const h = hash(ex.id);
  const bend = 14 + (h % 22);
  const flip = h % 2 ? 1 : -1;
  return (
    <svg viewBox="0 0 200 70" className="xbk-pitch" role="img" aria-label={`Geste : ${ex.title}`}>
      <rect x="1" y="1" width="198" height="68" rx="6" className="xbk-pitch-bg" />
      <path d={`M70 50 l5 -10 l5 10 z`} className="xbk-pitch-cone" />
      <path d={`M120 50 l5 -10 l5 10 z`} className="xbk-pitch-cone" />
      <path d={`M40 ${35 + flip * 4} C 75 ${35 - flip * bend}, 125 ${35 + flip * bend}, 160 ${35 - flip * 4}`} className="xbk-pitch-pass" fill="none" />
      <circle cx="160" cy={35 - flip * 4} r="5" className="xbk-pitch-ball" />
      <circle cx="40" cy={35 + flip * 4} r="4.2" className="xbk-pitch-a" />
    </svg>
  );
}

export function ExerciseVisual({ ex, eager }: { ex: BookExercise; eager?: boolean }) {
  return (
    <div className="xbk-visual" data-kind={ex.kind === "manquant" ? "manquant" : ex.kind === "geste" && !ex.imageUrl ? "geste" : undefined}>
      {ex.kind === "manquant" ? (
        <span className="xbk-missing-visual">
          <ImageUp size={22} strokeWidth={1.5} aria-hidden /> Diapo à ajouter
        </span>
      ) : ex.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ex.imageUrl} alt={`Schéma : ${ex.title}`} loading={eager ? "eager" : "lazy"} draggable={false} />
      ) : ex.diagram ? (
        <ExerciseDiagramView diagram={ex.diagram as unknown as ExerciseDiagram} />
      ) : ex.kind === "geste" ? (
        <IllustratedGesture ex={ex} />
      ) : (
        <IllustratedPitch ex={ex} />
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="xbk-sec">
      <h4>{label}</h4>
      {children}
    </section>
  );
}

function Lines({ text }: { text: string | null }) {
  if (!text) return null;
  const lines = text.split(/\n+/).map((l) => l.replace(/^[•\-–]\s*/, "").trim()).filter(Boolean);
  if (lines.length === 1) return <p>{lines[0]}</p>;
  return (
    <ul>
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
}

function Badges({ ex }: { ex: BookExercise }) {
  return (
    <p className="xbk-badges">
      {ex.kind === "manquant" ? <span data-tone="warn">Jour à ajouter</span> : null}
      {ex.kind === "geste" && ex.draft ? <span data-tone="warn">Fiche à valider par JP</span> : null}
      {ex.jpReference ? (
        <span data-tone="jp">
          <Award size={12} strokeWidth={2} aria-hidden /> JP référence
        </span>
      ) : null}
      {ex.approved ? (
        <span data-tone="good">
          <Star size={12} strokeWidth={2} aria-hidden /> Meilleur exercice{ex.average !== null ? ` · ${fr(ex.average)}/10` : ""}
        </span>
      ) : null}
      {ex.type && ex.kind !== "manquant" ? <span data-tone="accent">{ex.type}</span> : null}
      {ex.ages.length ? <span>{ex.ages.join(", ")}</span> : null}
      {ex.players ? <span>{ex.players}</span> : null}
      {ex.duration ? <span>{ex.duration} min</span> : null}
      {ex.venue ? <span>{ex.venue}</span> : null}
      {ex.level ? <span>{ex.level}</span> : null}
    </p>
  );
}

function JpNote({ ex }: { ex: BookExercise }) {
  if (!ex.jpReferenceNote) return null;
  return (
    <p className="xbk-jp-note">
      <Award size={14} strokeWidth={2} aria-hidden />
      <span>
        <strong>Le meilleur pour :</strong> {ex.jpReferenceNote}
      </span>
    </p>
  );
}

/** Admin seulement : JP marque (ou démarque) un exercice comme « JP référence », avec ce pour quoi c'est le meilleur. */
function JpReferenceControl({ ex }: { ex: BookExercise }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(ex.jpReferenceNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (action: "reference" | "annuler-reference") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exercises/${ex.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason: note }) });
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? "Pas enregistré. Réessaie.");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  if (editing) {
    return (
      <form
        className="xbk-jp-form"
        onSubmit={(e) => {
          e.preventDefault();
          send("reference");
        }}
      >
        <label>
          <span>Le meilleur pour (facultatif)</span>
          <input className="admin-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ex. : la passe qui traverse, U9-U10" autoFocus />
        </label>
        <span className="xbk-jp-form-actions">
          <button type="submit" className="admin-btn-primary" disabled={busy}>
            {busy ? "Un instant…" : ex.jpReference ? "Enregistrer" : "Marquer JP référence"}
          </button>
          <button type="button" className="admin-btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
            Annuler
          </button>
          {ex.jpReference ? (
            <button type="button" className="xbk-jp-remove" onClick={() => send("annuler-reference")} disabled={busy}>
              Retirer de JP référence
            </button>
          ) : null}
        </span>
        {error ? <span className="xbk-jp-error">{error}</span> : null}
      </form>
    );
  }
  return (
    <button type="button" className="admin-btn-ghost xbk-tool xbk-jp-toggle" data-on={ex.jpReference || undefined} onClick={() => setEditing(true)} aria-pressed={ex.jpReference}>
      <Award size={16} strokeWidth={1.75} aria-hidden /> {ex.jpReference ? "JP référence" : "Marquer JP référence"}
    </button>
  );
}

interface DeleteImpact {
  upcoming: { activityId: string; date: string; start: string; title: string }[];
  pastCount: number;
  ratings: number;
  routines: number;
}

const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });

/** Admin seulement (JP, 26 nov. 2026) : supprimer un exercice de la banque, ou le retirer pour garder l'historique.
 *  Refusé tant que l'exercice est prévu dans une pratique à venir : on montre lesquelles. */
function DeleteControl({ ex }: { ex: BookExercise }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setOpen(true);
    setError(null);
    setImpact(null);
    const res = await fetch(`/api/admin/exercises/${ex.id}`);
    if (res.ok) setImpact(await res.json());
    else setError("Impossible de vérifier où cet exercice est utilisé. Réessaie.");
  };
  const act = async (kind: "supprimer" | "retirer") => {
    setBusy(true);
    setError(null);
    try {
      const res =
        kind === "supprimer"
          ? await fetch(`/api/admin/exercises/${ex.id}`, { method: "DELETE" })
          : await fetch(`/api/admin/exercises/${ex.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retirer", reason: "Retiré depuis la Bible" }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.upcoming) setImpact((prev) => (prev ? { ...prev, upcoming: data.upcoming } : prev));
        setError(data?.error ?? "Ça n'a pas fonctionné. Réessaie.");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="admin-btn-ghost xbk-tool xbk-del-btn" onClick={start}>
        <Trash2 size={15} strokeWidth={1.75} aria-hidden /> Supprimer
      </button>
    );
  }
  const planned = impact?.upcoming ?? [];
  return (
    <div className="xbk-del" role="group" aria-label={`Supprimer « ${ex.title} »`}>
      {!impact && !error ? <p className="xbk-muted">Je vérifie où cet exercice est utilisé…</p> : null}
      {impact && planned.length ? (
        <>
          <p>
            <strong>Prévu dans {planned.length} pratique{planned.length > 1 ? "s" : ""} à venir :</strong> change-le dans {planned.length > 1 ? "ces pratiques" : "cette pratique"} avant de le supprimer, ou retire-le de la banque (il reste dans {planned.length > 1 ? "ces pratiques" : "cette pratique"}).
          </p>
          <ul>
            {planned.map((u) => (
              <li key={`${u.activityId}-${u.date}`}>
                <Link href={`/admin/entraineurs/activites/${u.activityId}`}>
                  {shortDate(u.date)}
                  {u.start ? ` · ${u.start.replace(":", " h ")}` : ""} · {u.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {impact && !planned.length ? (
        <p>
          <strong>Supprimer définitivement « {ex.title} » ?</strong>{" "}
          {impact.ratings ? `Ses ${impact.ratings} note${impact.ratings > 1 ? "s" : ""} d'éducateurs seront effacées. ` : ""}
          {impact.pastCount ? `${impact.pastCount} pratique${impact.pastCount > 1 ? "s" : ""} passée${impact.pastCount > 1 ? "s" : ""} garde${impact.pastCount > 1 ? "nt" : ""} son nom dans le plan. ` : ""}
          Pour garder l&apos;historique, retire-le plutôt : il sort de la Bible et des plans à venir, sans rien effacer.
        </p>
      ) : null}
      {error ? <p className="xbk-jp-error">{error}</p> : null}
      <span className="xbk-jp-form-actions">
        {impact && !planned.length ? (
          <button type="button" className="xbk-del-confirm" onClick={() => act("supprimer")} disabled={busy}>
            <Trash2 size={15} strokeWidth={1.75} aria-hidden /> {busy ? "Un instant…" : "Supprimer définitivement"}
          </button>
        ) : null}
        {impact ? (
          <button type="button" className="admin-btn-ghost xbk-tool" onClick={() => act("retirer")} disabled={busy}>
            <Archive size={15} strokeWidth={1.75} aria-hidden /> Retirer (garder l&apos;historique)
          </button>
        ) : null}
        <button type="button" className="admin-btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
          Annuler
        </button>
      </span>
    </div>
  );
}

/** Admin seulement : marquer JP référence et supprimer un exercice ; un geste se modifie dans la bibliothèque des gestes. */
function AdminActions({ ex }: { ex: BookExercise }) {
  if (ex.kind === "manquant") {
    return (
      <Link href="/admin/exercices/diapos?bible=ball-mastery" className="admin-btn-primary xbk-tool">
        <ImageUp size={15} strokeWidth={1.75} aria-hidden /> Ajouter ce jour
      </Link>
    );
  }
  if (ex.kind === "geste") {
    return (
      <Link href="/admin/coaching/gestes" className="admin-btn-ghost xbk-tool">
        <PencilLine size={15} strokeWidth={1.75} aria-hidden /> Modifier le geste
      </Link>
    );
  }
  return (
    <>
      <JpReferenceControl key={`${ex.id}-${ex.jpReference}`} ex={ex} />
      <DeleteControl key={`del-${ex.id}`} ex={ex} />
    </>
  );
}

/** Admin seulement : ajouter un exercice à la banque, par diapo (lue et rangée toute seule) ou en remplissant la fiche. */
function AddExerciseMenu({ bible }: { bible: BibleKey }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="xbk-add" ref={box}>
      <button type="button" className="admin-btn-primary xbk-tool" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <Plus size={16} strokeWidth={2} aria-hidden /> Ajouter un exercice <ChevronDown size={15} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div className="xbk-add-menu" role="menu">
          <Link href={`/admin/exercices/diapos?bible=${bible}`} role="menuitem">
            <ImageUp size={18} strokeWidth={1.75} aria-hidden />
            <span>
              <strong>Déposer des diapos</strong>
              <small>Une ou plusieurs images, ou un PDF de plusieurs pages (une page = un exercice) : rangés dans cette Bible.</small>
            </span>
          </Link>
          <Link href={`/admin/exercices/nouveau?bible=${bible}`} role="menuitem">
            <FilePlus2 size={18} strokeWidth={1.75} aria-hidden />
            <span>
              <strong>Remplir une fiche</strong>
              <small>La fiche Valkyria complète, champ par champ.</small>
            </span>
          </Link>
          {bible === "ball-mastery" ? (
            <Link href="/admin/coaching/gestes" role="menuitem">
              <Footprints size={18} strokeWidth={1.75} aria-hidden />
              <span>
                <strong>Ajouter un geste</strong>
                <small>Dans la bibliothèque des gestes de la méthode : il apparaît ici.</small>
              </span>
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Routine → ses gestes dans la bibliothèque ; geste → les jours de programme où il est travaillé. Cliquables. */
function LinkedMoves({ ex, onLink }: { ex: BookExercise; onLink?: (id: string) => void }) {
  if (!ex.links.length) return null;
  return (
    <Section label={ex.kind === "geste" ? "Travaillé dans" : `Les gestes du jour (${ex.links.length})`}>
      <span className="xbk-links">
        {ex.links.map((l) =>
          onLink ? (
            <button key={l.id} type="button" onClick={() => onLink(l.id)}>
              {ex.kind === "geste" ? l.title.replace(/^ball mastery\s+/i, "") : l.title}
            </button>
          ) : (
            <span key={l.id}>{ex.kind === "geste" ? l.title.replace(/^ball mastery\s+/i, "") : l.title}</span>
          )
        )}
      </span>
    </Section>
  );
}

/** La fiche complète d'un exercice : schéma, organisation, déroulement, consignes, variantes, tout. */
export function ExerciseSheet({ ex, eager, onLink }: { ex: BookExercise; eager?: boolean; onLink?: (id: string) => void }) {
  const hasVariants = ex.easier || ex.harder || ex.cognitive || ex.variants;
  return (
    <div className="xbk-sheet">
      <h3 className="xbk-sheet-title">{ex.title}</h3>
      <Badges ex={ex} />
      <JpNote ex={ex} />
      <ExerciseVisual ex={ex} eager={eager} />
      <LinkedMoves ex={ex} onLink={onLink} />
      {ex.objective ? (
        <Section label="Objectif">
          <Lines text={ex.objective} />
        </Section>
      ) : null}
      {ex.dimensions || ex.setups.length || ex.place ? (
        <Section label="Organisation">
          {ex.dimensions ? <Lines text={ex.dimensions} /> : null}
          {ex.setups.length ? (
            <dl className="xbk-dl">
              {ex.setups.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {ex.place ? <p className="xbk-muted">Place dans la séance : {ex.place}</p> : null}
        </Section>
      ) : null}
      {ex.instructions ? (
        <Section label={ex.kind === "geste" ? "Exécution" : ex.kind === "manquant" ? "À faire" : "Déroulement"}>
          <Lines text={ex.instructions} />
        </Section>
      ) : null}
      {ex.coachingPoints ? (
        <Section label={ex.kind === "geste" ? "Les 3 points clés" : "Consignes clés"}>
          <Lines text={ex.coachingPoints} />
        </Section>
      ) : null}
      {hasVariants ? (
        <Section label="Variantes">
          <dl className="xbk-dl">
            {ex.easier ? (
              <div>
                <dt>Plus facile</dt>
                <dd>{ex.easier}</dd>
              </div>
            ) : null}
            {ex.harder ? (
              <div>
                <dt>Plus difficile</dt>
                <dd>{ex.harder}</dd>
              </div>
            ) : null}
            {ex.cognitive ? (
              <div>
                <dt>Cognitive</dt>
                <dd>{ex.cognitive}</dd>
              </div>
            ) : null}
            {ex.variants ? (
              <div>
                <dt>Autres</dt>
                <dd>{ex.variants}</dd>
              </div>
            ) : null}
          </dl>
        </Section>
      ) : null}
      {ex.progression ? (
        <Section label="Progression">
          <Lines text={ex.progression} />
        </Section>
      ) : null}
      {ex.mistakes ? (
        <Section label="Erreurs fréquentes">
          <Lines text={ex.mistakes} />
        </Section>
      ) : null}
      {ex.material ? (
        <Section label="Matériel">
          <p>{ex.material}</p>
        </Section>
      ) : null}
      {ex.versions.length ? (
        <Section label={ex.versions.length > 1 ? `${ex.versions.length} autres versions (même diapo)` : "Autre version (même diapo)"}>
          {ex.versions.map((v) => (
            <details key={v.id} className="xbk-version">
              <summary>
                {v.title}
                {v.type || v.chapter !== ex.chapter ? <span className="xbk-muted"> · {[v.chapter !== ex.chapter ? v.chapter : null, v.type].filter(Boolean).join(" · ")}</span> : null}
              </summary>
              {v.instructions ? <Lines text={v.instructions} /> : null}
              {v.coachingPoints ? <Lines text={v.coachingPoints} /> : null}
            </details>
          ))}
        </Section>
      ) : null}
      {ex.videoUrl ? (
        <a className="xbk-link" href={ex.videoUrl} target="_blank" rel="noreferrer">
          Voir la vidéo
        </a>
      ) : null}
    </div>
  );
}

/* ── Le livre ─────────────────────────────────────────────────────────────── */

function Cover({ total, chapters, best, bible }: { total: number; chapters: number; best: number; bible: BibleKey }) {
  const info = bibleInfo(bible);
  return (
    <div className="xbk-cover">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={64} height={76} className="xbk-cover-logo" />
      <p className="xbk-cover-eyebrow">Académie New Valkyria</p>
      <h2 className="xbk-cover-title">{info.title}</h2>
      <p className="xbk-cover-sub">{info.subtitle}</p>
      <dl className="xbk-cover-stats">
        <div>
          <dt>Exercices</dt>
          <dd>{total}</dd>
        </div>
        <div>
          <dt>Chapitres</dt>
          <dd>{chapters}</dd>
        </div>
        <div>
          <dt>Meilleurs</dt>
          <dd>{best}</dd>
        </div>
      </dl>
      <p className="xbk-cover-hint">Tourne les pages avec les flèches, le clavier ou en glissant.</p>
    </div>
  );
}

function Contents({ chapters, starts, onGo }: { chapters: BookChapter[]; starts: Map<string, number>; onGo: (page: number) => void }) {
  return (
    <div className="xbk-contents">
      <p className="xbk-kicker">Sommaire</p>
      <h2 className="xbk-page-h">Les chapitres</h2>
      <ol>
        {chapters.map((c) => (
          <li key={c.key}>
            <button type="button" onClick={() => onGo(starts.get(c.key) ?? 0)}>
              <span className="xbk-toc-num">{c.number}</span>
              <span className="xbk-toc-title">
                {c.title}
                <small>
                  {c.exercises.length} exercice{c.exercises.length > 1 ? "s" : ""}
                  {c.approved ? ` · ${c.approved} meilleur${c.approved > 1 ? "s" : ""}` : ""}
                </small>
              </span>
              <span className="xbk-toc-page">p. {starts.get(c.key)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ChapterOpener({ chapter, onGo, pages }: { chapter: BookChapter; onGo: (page: number) => void; pages: BookPage[] }) {
  return (
    <div className="xbk-chapter">
      <p className="xbk-kicker">Chapitre {chapter.number}</p>
      <h2 className="xbk-chapter-title">{chapter.title}</h2>
      <p className="xbk-muted">
        {chapter.exercises.length} exercice{chapter.exercises.length > 1 ? "s" : ""} · {chapter.types.join(", ")}
      </p>
      <div className="xbk-chapter-thumbs">
        {chapter.exercises.slice(0, 6).map((e) => (
          <button key={e.id} type="button" onClick={() => onGo(pageOfExercise(pages, e.id))} title={e.title}>
            <ExerciseVisual ex={e} />
            <span>{e.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Page({ page, ctx }: { page: BookPage; ctx: { chapters: BookChapter[]; starts: Map<string, number>; pages: BookPage[]; total: number; best: number; onGo: (p: number) => void; ficheBase?: string; bible: BibleKey } }) {
  let body: React.ReactNode;
  if (page.kind === "cover") body = <Cover total={ctx.total} chapters={ctx.chapters.length} best={ctx.best} bible={ctx.bible} />;
  else if (page.kind === "contents") body = <Contents chapters={ctx.chapters} starts={ctx.starts} onGo={ctx.onGo} />;
  else if (page.kind === "chapter") body = <ChapterOpener chapter={page.chapter} onGo={ctx.onGo} pages={ctx.pages} />;
  else
    body = (
      <>
        <p className="xbk-running">
          <span>
            Chapitre {page.chapter.number} · {page.chapter.title}
            {page.exercise.type && page.exercise.type !== page.chapter.title ? ` · ${page.exercise.type}` : ""}
          </span>
          {ctx.ficheBase && page.exercise.kind === "exercice" ? (
            <Link href={`${ctx.ficheBase}/${page.exercise.id}`} className="xbk-edit">
              <PencilLine size={14} strokeWidth={1.75} aria-hidden /> Modifier
            </Link>
          ) : null}
        </p>
        {ctx.ficheBase ? (
          <div className="xbk-admin-actions">
            <AdminActions ex={page.exercise} />
          </div>
        ) : null}
        <ExerciseSheet ex={page.exercise} eager onLink={(id) => ctx.onGo(pageOfExercise(ctx.pages, id))} />
      </>
    );
  return (
    <article className="xbk-page" data-kind={page.kind} aria-label={page.kind === "exercise" ? page.exercise.title : undefined}>
      <div className="xbk-page-inner">{body}</div>
      {page.number > 0 ? <p className="xbk-folio">{page.number}</p> : null}
    </article>
  );
}

function useWide(ref: React.RefObject<HTMLElement | null>, min: number) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= min));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, min]);
  return wide;
}

function Book({ pages, chapters, page, setPage, total, best, ficheBase, bible }: { pages: BookPage[]; chapters: BookChapter[]; page: number; setPage: (p: number) => void; total: number; best: number; ficheBase?: string; bible: BibleKey }) {
  const box = useRef<HTMLDivElement>(null);
  const double = useWide(box, 960);
  const starts = useMemo(() => chapterStarts(pages), [pages]);
  const start = spreadStart(page, double);
  const shown = double && start > 0 ? [start, start + 1].filter((i) => i < pages.length) : [start];
  const [dir, setDir] = useState<1 | -1>(1);
  const turn = useCallback(
    (d: 1 | -1) => {
      setDir(d);
      setPage(turnPage(page, d, double, pages.length));
    },
    [page, double, pages.length, setPage]
  );
  const go = (p: number) => {
    setDir(p >= page ? 1 : -1);
    setPage(Math.max(0, Math.min(pages.length - 1, p)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (document.querySelector(".xbk-modal")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        turn(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        turn(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        go(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Glisser (souris ou doigt) pour tourner la page ; le défilement vertical reste libre.
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input, select")) return;
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
  };

  const current = pages[shown[shown.length - 1]];
  const chapterNow = current && (current.kind === "chapter" || current.kind === "exercise") ? current.chapter.key : "";
  const atEnd = turnPage(page, 1, double, pages.length) === start;

  return (
    <div className="xbk-book-wrap" ref={box}>
      <div className="xbk-toolbar">
        <button type="button" className="admin-btn-ghost xbk-tool" onClick={() => go(1)}>
          <ListOrdered size={16} strokeWidth={1.75} aria-hidden /> Sommaire
        </button>
        <select className="admin-input xbk-select" value={chapterNow} onChange={(e) => e.target.value && go(starts.get(e.target.value) ?? 0)} aria-label="Aller au chapitre">
          <option value="">Aller au chapitre…</option>
          {chapters.map((c) => (
            <option key={c.key} value={c.key}>
              {c.number}. {c.title} ({c.exercises.length})
            </option>
          ))}
        </select>
        <span className="xbk-count" aria-live="polite">
          {shown[0] === 0 ? "Couverture" : `Page ${shown.join("–")} sur ${pages.length - 1}`}
        </span>
      </div>

      <div className="xbk-stage">
        <button type="button" className="xbk-turn" data-side="prev" onClick={() => turn(-1)} disabled={start === 0} aria-label="Page précédente">
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <div
          className="xbk-book"
          data-double={String(double)}
          data-single-cover={String(double && start === 0)}
          data-dir={dir}
          key={start}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = null)}
        >
          {shown.map((i) => (
            <Page key={i} page={pages[i]} ctx={{ chapters, starts, pages, total, best, onGo: go, ficheBase, bible }} />
          ))}
        </div>
        <button type="button" className="xbk-turn" data-side="next" onClick={() => turn(1)} disabled={atEnd} aria-label="Page suivante">
          <ChevronRight size={22} strokeWidth={1.75} />
        </button>
      </div>

      <div className="xbk-mobile-nav">
        <button type="button" className="admin-btn-ghost" onClick={() => turn(-1)} disabled={start === 0}>
          <ChevronLeft size={16} strokeWidth={1.75} aria-hidden /> Précédente
        </button>
        <button type="button" className="admin-btn-ghost" onClick={() => turn(1)} disabled={atEnd}>
          Suivante <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ── La grille (descriptif) ───────────────────────────────────────────────── */

function Card({ ex, onOpen, showNote }: { ex: BookExercise; onOpen: () => void; showNote?: boolean }) {
  return (
    <button type="button" className="xbk-card" onClick={onOpen}>
      <ExerciseVisual ex={ex} />
      <span className="xbk-card-body">
        <span className="xbk-card-title">
          {ex.jpReference ? <Award size={14} strokeWidth={2} className="xbk-jp-icon" aria-label="JP référence" /> : ex.approved ? <Star size={14} strokeWidth={2} className="xbk-star" aria-label="Meilleur exercice" /> : null}
          {ex.title}
        </span>
        {showNote && ex.jpReferenceNote ? <span className="xbk-card-note">Le meilleur pour : {ex.jpReferenceNote}</span> : null}
        <span className="xbk-card-meta">
          {ex.chapter}
          {ex.type ? ` · ${ex.type}` : ""}
          {ex.ages.length ? ` · ${ex.ages.join(", ")}` : ""}
        </span>
      </span>
    </button>
  );
}

/** Une grande fiche du descriptif (JP, 26 nov. 2026) : la diapo entière et, à côté, l'explication, la progression et la
 *  limite (variantes), lisibles sans ouvrir la fiche. */
function WideCard({ ex, onOpen, canMark, onLink }: { ex: BookExercise; onOpen: () => void; canMark: boolean; onLink?: (id: string) => void }) {
  const gesture = ex.kind === "geste";
  const explanation = gesture ? ex.instructions : ex.instructions ?? ex.coachingPoints;
  return (
    <article className="xbk-wide" data-jp={ex.jpReference || undefined} aria-label={ex.title}>
      <button type="button" className="xbk-wide-visual" onClick={onOpen} aria-label={`Ouvrir la fiche complète : ${ex.title}`}>
        <ExerciseVisual ex={ex} />
      </button>
      <div className="xbk-wide-body">
        <div className="xbk-wide-head">
          <p className="xbk-wide-kicker">{ex.chapter}</p>
          <h3 className="xbk-wide-title">{ex.title}</h3>
          <Badges ex={ex} />
          <JpNote ex={ex} />
        </div>
        {ex.objective ? <p className="xbk-wide-objective">{ex.objective}</p> : null}
        <LinkedMoves ex={ex} onLink={onLink} />
        {ex.dimensions ? (
          <p className="xbk-wide-space">
            <strong>Espace :</strong> {ex.dimensions}
          </p>
        ) : null}
        {explanation ? (
          <Section label={gesture ? "Exécution" : "Explication"}>
            <Lines text={explanation} />
          </Section>
        ) : null}
        {gesture && ex.coachingPoints ? (
          <Section label="Les 3 points clés">
            <Lines text={ex.coachingPoints} />
          </Section>
        ) : null}
        {ex.progression ? (
          <Section label={gesture ? "Progression en 4 étapes" : "Progression"}>
            <Lines text={ex.progression} />
          </Section>
        ) : null}
        {gesture && ex.mistakes ? (
          <Section label="Erreurs fréquentes">
            <Lines text={ex.mistakes} />
          </Section>
        ) : null}
        {ex.easier || ex.harder ? (
          <Section label="Variantes et limite">
            <dl className="xbk-dl">
              {ex.easier ? (
                <div>
                  <dt>Plus facile</dt>
                  <dd>{ex.easier}</dd>
                </div>
              ) : null}
              {ex.harder ? (
                <div>
                  <dt>Plus difficile</dt>
                  <dd>{ex.harder}</dd>
                </div>
              ) : null}
            </dl>
          </Section>
        ) : null}
        <div className="xbk-wide-foot">
          <button type="button" className="admin-btn-ghost xbk-tool" onClick={onOpen}>
            <Maximize2 size={15} strokeWidth={1.75} aria-hidden /> Fiche complète
          </button>
          {canMark ? <AdminActions ex={ex} /> : null}
        </div>
      </div>
    </article>
  );
}

function Grid({ list, chapters, onOpen, canMark }: { list: BookExercise[]; chapters: BookChapter[]; onOpen: (id: string) => void; canMark: boolean }) {
  const [q, setQ] = useState("");
  const [chapter, setChapter] = useState("");
  const [best, setBest] = useState(false);
  const [jp, setJp] = useState(false);
  const [layout, setLayout] = useState<"fiches" | "vignettes">("fiches");
  const [limit, setLimit] = useState(GRID_STEP);
  const more = useRef<HTMLDivElement>(null);
  const shown = list.filter((e) => matchesGrid(e, { q, chapter, best, jp }));
  const jpCount = list.filter((e) => e.jpReference).length;

  useEffect(() => {
    try {
      const v = localStorage.getItem(GRID_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "fiches" || v === "vignettes") setLayout(v);
    } catch {
      /* stockage indisponible : grandes fiches */
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLimit(GRID_STEP), [q, chapter, best, jp, layout]);
  // Les grandes fiches arrivent par paquets de 16 en défilant (380 diapos d'un coup alourdiraient la page).
  useEffect(() => {
    const el = more.current;
    if (!el || layout !== "fiches") return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setLimit((n) => n + GRID_STEP), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [layout, limit, shown.length]);
  const chooseLayout = (v: "fiches" | "vignettes") => {
    setLayout(v);
    try {
      localStorage.setItem(GRID_KEY, v);
    } catch {
      /* rien */
    }
  };

  return (
    <div className="xbk-grid-wrap">
      <div className="xbk-grid-filters">
        <div className="xbk-grid-bar">
          <label className="xbk-search">
            <Search size={16} strokeWidth={1.75} aria-hidden />
            <input className="admin-input" type="search" placeholder="Chercher un exercice, un thème, un âge" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher" />
          </label>
          <div className="xbk-seg" role="group" aria-label="Taille de l'affichage">
            <button type="button" aria-pressed={layout === "fiches"} onClick={() => chooseLayout("fiches")}>
              <LayoutList size={16} strokeWidth={1.75} aria-hidden /> Grandes fiches
            </button>
            <button type="button" aria-pressed={layout === "vignettes"} onClick={() => chooseLayout("vignettes")}>
              <LayoutGrid size={16} strokeWidth={1.75} aria-hidden /> Vignettes
            </button>
          </div>
        </div>
        <div className="xbk-chips" role="group" aria-label="Chapitre">
          <button type="button" data-on={String(!chapter && !best && !jp)} onClick={() => { setChapter(""); setBest(false); setJp(false); }}>Tous ({list.length})</button>
          <button type="button" data-on={String(jp)} onClick={() => setJp(!jp)}>
            <Award size={13} strokeWidth={2} aria-hidden /> JP référence ({jpCount})
          </button>
          <button type="button" data-on={String(best)} onClick={() => setBest(!best)}>
            <Star size={13} strokeWidth={2} aria-hidden /> Meilleurs
          </button>
          {chapters.map((c) => (
            <button key={c.key} type="button" data-on={String(chapter === c.key)} onClick={() => setChapter(chapter === c.key ? "" : c.key)}>
              {c.title} ({c.exercises.length})
            </button>
          ))}
        </div>
      </div>
      {!shown.length ? (
        <p className="xbk-empty">Aucun exercice pour cette recherche.</p>
      ) : layout === "vignettes" ? (
        <div className="xbk-grid">
          {shown.map((e) => <Card key={e.id} ex={e} onOpen={() => onOpen(e.id)} />)}
        </div>
      ) : (
        <div className="xbk-wide-list">
          <p className="xbk-muted">
            {shown.length} exercice{shown.length > 1 ? "s" : ""} · la diapo entière, l&apos;explication, la progression et la limite ; « Fiche complète » pour l&apos;organisation selon le nombre et les consignes.
          </p>
          {shown.slice(0, limit).map((e) => <WideCard key={e.id} ex={e} onOpen={() => onOpen(e.id)} canMark={canMark} onLink={onOpen} />)}
          {limit < shown.length ? (
            <div ref={more} className="xbk-wide-more">
              <button type="button" className="admin-btn-ghost" onClick={() => setLimit((n) => n + GRID_STEP)}>
                Voir {Math.min(GRID_STEP, shown.length - limit)} exercices de plus ({shown.length - limit} restants)
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Modal({ ex, onClose, onBook, ficheBase, onLink }: { ex: BookExercise; onClose: () => void; onBook: () => void; ficheBase?: string; onLink?: (id: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="xbk-modal" role="dialog" aria-modal="true" aria-label={ex.title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="xbk-modal-box">
        <div className="xbk-modal-head">
          <span className="xbk-muted">
            {ex.chapter}
            {ex.type ? ` · ${ex.type}` : ""}
          </span>
          <span className="xbk-modal-actions">
            <button type="button" className="admin-btn-ghost xbk-tool" onClick={onBook}>
              <BookOpen size={16} strokeWidth={1.75} aria-hidden /> Voir dans la Bible
            </button>
            {ficheBase && ex.kind === "exercice" ? (
              <Link href={`${ficheBase}/${ex.id}`} className="admin-btn-ghost xbk-tool">
                <PencilLine size={16} strokeWidth={1.75} aria-hidden /> Modifier
              </Link>
            ) : null}
            {ficheBase ? <AdminActions ex={ex} /> : null}
            <button type="button" className="xbk-close" onClick={onClose} aria-label="Fermer">
              <X size={20} strokeWidth={1.75} />
            </button>
          </span>
        </div>
        <ExerciseSheet ex={ex} eager onLink={onLink} />
      </div>
    </div>
  );
}

/* ── La page ───────────────────────────────────────────────────────────────── */

const BIBLE_ICON: Record<BibleKey, typeof BookOpen> = { valkyria: BookOpen, psychomotricite: Shapes, "ball-mastery": Dumbbell };

/** Les 3 Bibles (JP, 26 nov. 2026) : un lien par Bible, avec son nombre d'exercices. */
function BibleSwitcher({ bible, counts, basePath }: { bible: BibleKey; counts: Partial<Record<BibleKey, number>>; basePath: string }) {
  return (
    <nav className="xbk-bibles" aria-label="Les Bibles">
      {BIBLES.map((b) => {
        const Icon = BIBLE_ICON[b.key];
        return (
          <Link key={b.key} href={b.key === "valkyria" ? basePath : `${basePath}?bible=${b.key}`} aria-current={b.key === bible ? "page" : undefined}>
            <Icon size={16} strokeWidth={1.75} aria-hidden />
            <span>{b.short}</span>
            {counts[b.key] !== undefined ? <small>{counts[b.key]}</small> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Une Bible : exercices JP référence, meilleurs exercices, le livre (une page par exercice, un chapitre par thème) et la grille.
 *  `bible` choisit le titre, les chapitres et l'endroit où l'ajout range l'exercice ; `basePath` + `counts` montrent le sélecteur. */
export function ExerciseBible({ exercises, ficheBase, bible = "valkyria", counts, basePath }: { exercises: BookExercise[]; ficheBase?: string; bible?: BibleKey; counts?: Partial<Record<BibleKey, number>>; basePath?: string }) {
  const info = bibleInfo(bible);
  const order = useMemo(() => bibleChapterOrder(bible, exercises), [bible, exercises]);
  const realCount = exercises.filter((e) => e.kind !== "manquant").length;
  const pageKey = `${PAGE_KEY}:${bible}`;
  const chapters = useMemo(() => bookChapters(exercises, order), [exercises, order]);
  const pages = useMemo(() => bookPages(chapters), [chapters]);
  const best = useMemo(() => bestExercises(exercises, 12), [exercises]);
  const references = useMemo(() => jpReferenceExercises(exercises, order), [exercises, order]);
  const approvedCount = exercises.filter((e) => e.approved).length;
  const [view, setView] = useState<"livre" | "grille">("livre");
  const [page, setPageState] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      const p = parseInt(localStorage.getItem(pageKey) ?? "", 10);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v === "grille" || v === "livre") setView(v);
      if (Number.isFinite(p) && p > 0 && p < pages.length) setPageState(p);
    } catch {
      /* stockage indisponible : on part de la couverture */
    }
  }, [pages.length, pageKey]);
  const setPage = useCallback(
    (p: number) => {
      setPageState(p);
      try {
        localStorage.setItem(pageKey, String(p));
      } catch {
        /* rien */
      }
    },
    [pageKey]
  );
  const choose = (v: "livre" | "grille") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* rien */
    }
  };
  const openEx = open ? exercises.find((e) => e.id === open) ?? null : null;
  const toBook = (id: string) => {
    setOpen(null);
    choose("livre");
    setPage(pageOfExercise(pages, id));
  };

  return (
    <div className="xbk">
      {basePath && counts ? <BibleSwitcher bible={bible} counts={counts} basePath={basePath} /> : null}
      {ficheBase ? (
        <div className="xbk-admin-bar">
          <p className="xbk-muted">
            <strong>{info.title}</strong>, comme les éducateurs la voient. Tu es le seul à pouvoir ajouter, marquer et supprimer.
          </p>
          <AddExerciseMenu bible={bible} />
        </div>
      ) : null}
      {exercises.length === 0 ? (
        <section className="xbk-empty-bible" aria-label={info.title}>
          <Shapes size={28} strokeWidth={1.5} aria-hidden />
          <h2 className="mda-h2" style={{ margin: 0 }}>{info.title} est vide pour l&apos;instant</h2>
          {ficheBase ? (
            <>
              <p>Dépose tes exercices : une ou plusieurs diapos à la fois, ou un PDF de plusieurs pages (chaque page devient un exercice). Ils sont lus et rangés directement dans cette Bible, par chapitre.</p>
              <span className="xbk-jp-form-actions" style={{ justifyContent: "center" }}>
                <Link href={`/admin/exercices/diapos?bible=${bible}`} className="admin-btn-primary xbk-tool">
                  <ImageUp size={16} strokeWidth={1.75} aria-hidden /> Déposer des diapos
                </Link>
                <Link href={`/admin/exercices/nouveau?bible=${bible}`} className="admin-btn-ghost xbk-tool">
                  <FilePlus2 size={16} strokeWidth={1.75} aria-hidden /> Remplir une fiche
                </Link>
              </span>
            </>
          ) : (
            <p>JP prépare cette Bible : les exercices arrivent bientôt.</p>
          )}
        </section>
      ) : (
        <>
      <section className="xbk-best" data-kind="jp" aria-label="Exercices JP référence">
        <div className="xbk-best-head">
          <h2 className="mda-h2" style={{ margin: 0 }}>
            <Award size={16} strokeWidth={2} className="xbk-jp-icon" aria-hidden /> Exercices JP référence
          </h2>
          <p className="xbk-muted">Les exercices phares de JP : ses meilleurs pour chaque thème.</p>
        </div>
        {references.length ? (
          <div className="xbk-best-row">
            {references.map((e) => <Card key={e.id} ex={e} onOpen={() => setOpen(e.id)} showNote />)}
          </div>
        ) : (
          <p className="xbk-empty">
            {ficheBase
              ? "Aucun pour l'instant. Ouvre un exercice (Descriptif ou la Bible) et touche « Marquer JP référence », avec ce pour quoi c'est le meilleur."
              : "JP n'a pas encore choisi ses exercices de référence."}
          </p>
        )}
      </section>

      <section className="xbk-best" aria-label="Meilleurs exercices">
        <div className="xbk-best-head">
          <h2 className="mda-h2" style={{ margin: 0 }}>
            <Star size={16} strokeWidth={2} className="xbk-star" aria-hidden /> Meilleurs exercices
          </h2>
          <p className="xbk-muted">Approuvés : 2 éducatrices à 8/10 ou plus, ou validés par JP.</p>
        </div>
        {best.length ? (
          <div className="xbk-best-row">
            {best.map((e) => <Card key={e.id} ex={e} onOpen={() => setOpen(e.id)} />)}
          </div>
        ) : (
          <p className="xbk-empty">Aucun exercice approuvé pour l&apos;instant. Note chaque exercice après ta pratique : à 8/10 et plus par 2 éducatrices, il entre ici.</p>
        )}
      </section>

      <div className="xbk-tabs" role="tablist" aria-label="Affichage">
        <button type="button" role="tab" aria-selected={view === "livre"} onClick={() => choose("livre")}>
          <BookOpen size={16} strokeWidth={1.75} aria-hidden /> La Bible
        </button>
        <button type="button" role="tab" aria-selected={view === "grille"} onClick={() => choose("grille")}>
          <LayoutGrid size={16} strokeWidth={1.75} aria-hidden /> Descriptif ({realCount})
        </button>
      </div>

      {view === "livre" ? (
        <Book pages={pages} chapters={chapters} page={Math.min(page, pages.length - 1)} setPage={setPage} total={realCount} best={approvedCount} ficheBase={ficheBase} bible={bible} />
      ) : (
        <Grid list={exercises} chapters={chapters} onOpen={setOpen} canMark={Boolean(ficheBase)} />
      )}
        </>
      )}

      {openEx ? <Modal key={openEx.id} ex={openEx} onClose={() => setOpen(null)} onBook={() => toBook(openEx.id)} ficheBase={ficheBase} onLink={setOpen} /> : null}
    </div>
  );
}

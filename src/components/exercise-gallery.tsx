"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ExerciseDiagramView } from "@/components/exercise-diagram";
import { STATUS_LABEL } from "@/lib/exercise-bank";
import { matchesSlide, type GallerySlide } from "@/lib/exercise-gallery";

const fr = (n: number | null) => (n === null ? null : n.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));

function Block({ label, text }: { label: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <div className="xg-block">
      <p className="xg-block-label">{label}</p>
      <p className="xg-block-text">{text}</p>
    </div>
  );
}

function Slide({ s, ficheHref }: { s: GallerySlide; ficheHref?: string }) {
  return (
    <article className="xg-slide" aria-roledescription="diapo" aria-label={s.title}>
      <div className="xg-media">
        {s.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.imageUrl} alt={`Diapo : ${s.title}`} loading="lazy" draggable={false} />
        ) : s.diagram ? (
          <ExerciseDiagramView diagram={s.diagram} />
        ) : (
          <p className="xg-nomedia">Pas encore de diapo pour cet exercice</p>
        )}
      </div>
      <div className="xg-body">
        <h2 className="xg-title">
          {s.top ? <span title="Top exercice">★ </span> : null}
          {s.title}
        </h2>
        <p className="xg-tags">
          {s.status !== "approuve" ? <span data-tone="warn">{STATUS_LABEL[s.status]}</span> : null}
          {s.theme ? <span data-tone="accent">{s.theme}</span> : null}
          {s.ages.length ? <span>{s.ages.join(", ")}</span> : null}
          {s.tags.map((t) => <span key={t}>{t}</span>)}
          {s.average !== null ? <span>{fr(s.average)}/10</span> : null}
        </p>
        <Block label="Objectif" text={s.objective} />
        <Block label="Déroulement" text={s.instructions} />
        <Block label="Points clés" text={s.coachingPoints} />
        {s.setup.map((x) => <Block key={x.label} label={`Avec ${x.label}`} text={x.text} />)}
        <Block label="Plus facile" text={s.easier} />
        <Block label="Plus difficile" text={s.harder} />
        <Block label="Matériel" text={s.material} />
        <div className="xg-links">
          {s.videoUrl ? <a href={s.videoUrl} target="_blank" rel="noreferrer">Voir la vidéo ↗</a> : null}
          {ficheHref ? <Link href={ficheHref}>Ouvrir la fiche</Link> : null}
        </div>
      </div>
    </article>
  );
}

/** Les exercices en diapos : on balaie d'un exercice à l'autre (doigt, flèches ou clavier), filtrés par âge et thème. */
export function ExerciseGallery({ slides, ficheBase, allHref, approvedHref, showingAll }: { slides: GallerySlide[]; ficheBase?: string; allHref?: string; approvedHref?: string; showingAll?: boolean }) {
  const [age, setAge] = useState("");
  const [theme, setTheme] = useState("");
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const list = slides.filter((s) => matchesSlide(s, { age, theme }));
  const ages = [...new Set(slides.flatMap((s) => s.ages))].sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
  const themes = [...new Set(slides.map((s) => s.theme).filter((t): t is string => Boolean(t)))].sort((a, b) => a.localeCompare(b, "fr"));

  // À la souris (ordinateur), on peut aussi glisser la diapo ; au doigt, le défilement natif suffit.
  const drag = useRef<{ x: number; left: number; index: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = e.currentTarget;
    drag.current = { x: e.clientX, left: el.scrollLeft, index };
    el.style.scrollSnapType = "none";
    el.style.scrollBehavior = "auto";
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const el = e.currentTarget;
    const dx = e.clientX - drag.current.x;
    const from = drag.current.index;
    drag.current = null;
    el.style.scrollSnapType = "";
    el.style.scrollBehavior = "";
    go(Math.abs(dx) > 60 ? from + (dx < 0 ? 1 : -1) : from);
  };

  const go = (i: number) => {
    const el = track.current;
    if (!el || !list.length) return;
    const next = Math.max(0, Math.min(list.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };
  const reset = (fn: () => void) => {
    fn();
    setIndex(0);
    track.current?.scrollTo({ left: 0 });
  };

  return (
    <div className="xg">
      <div className="xg-filters">
        {ages.length > 1 && (
          <div className="xg-chips" role="group" aria-label="Âge">
            <button type="button" data-on={String(!age)} onClick={() => reset(() => setAge(""))}>Tous les âges</button>
            {ages.map((a) => (
              <button key={a} type="button" data-on={String(age === a)} onClick={() => reset(() => setAge(age === a ? "" : a))}>{a}</button>
            ))}
          </div>
        )}
        {themes.length > 1 && (
          <select className="admin-input xg-select" value={theme} onChange={(e) => reset(() => setTheme(e.target.value))} aria-label="Thème">
            <option value="">Tous les thèmes</option>
            {themes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {(allHref || approvedHref) && (
          <a className="xg-toggle" href={showingAll ? approvedHref : allHref}>{showingAll ? "Seulement les approuvés" : "Voir aussi ceux à tester"}</a>
        )}
      </div>

      {list.length === 0 ? (
        <p className="xg-empty">{slides.length ? "Aucun exercice pour ce filtre." : showingAll ? "La banque est vide." : "Aucun exercice approuvé pour l'instant : un exercice est approuvé quand 2 éducateurs lui donnent 8/10 ou plus et que JP le valide."}</p>
      ) : (
        <>
          <div className="xg-nav">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Exercice précédent">←</button>
            <span aria-live="polite">{Math.min(index + 1, list.length)} / {list.length}</span>
            <button type="button" onClick={() => go(index + 1)} disabled={index >= list.length - 1} aria-label="Exercice suivant">→</button>
          </div>
          <div
            ref={track}
            className="xg-track"
            tabIndex={0}
            aria-label="Exercices : balayer vers la gauche ou la droite"
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
              if (i !== index) setIndex(i);
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
              if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
            }}
          >
            {list.map((s) => <Slide key={s.id} s={s} ficheHref={ficheBase ? `${ficheBase}/${s.id}` : undefined} />)}
          </div>
          {list.length > 1 && list.length <= 30 && (
            <div className="xg-dots" aria-hidden>
              {list.map((s, i) => <span key={s.id} data-on={String(i === index)} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

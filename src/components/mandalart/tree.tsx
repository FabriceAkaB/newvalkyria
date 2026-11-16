"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { HUES } from "@/components/mandalart/board";
import type { Medal } from "@/lib/mandalart-core";

import s from "./tree.module.css";

/** L'arbre du Mandalart : une guerrière Valkyrie à genoux plante son épée, et l'arbre pousse de l'épée.
 *  8 branches = les 8 piliers, 8 feuilles par branche = les 64 objectifs. Une feuille se remplit de la couleur de son
 *  pilier à mesure que ses tâches sont faites, devient dorée à 100 % et mauve quand ses indicateurs sont atteints.
 *  Un clic sur une branche ou une feuille ouvre le détail. */

export interface TreeTask {
  code: string;
  title: string;
  status: "a_faire" | "en_cours" | "fait" | "abandonne";
  due: string | null;
  overdue: boolean;
  star: boolean;
}
export interface TreeObjective {
  code: string;
  name: string;
  progress: number;
  medal: Medal;
  total: number;
  done: number;
  overdue: number;
  tasks: TreeTask[];
}
export interface TreePillar {
  code: string;
  name: string;
  progress: number;
  overdue: number;
  starsOpen: number;
  objectives: TreeObjective[];
}

type Sel = { pillar: number; objective: number | null } | null;
type Pt = { x: number; y: number };

const TRUNK_X = 500;
const GOLD = "#f2c14e";
const MAUVE = "#b49bf2";
/** Angles des branches (0° = vers la droite, 90° = vers le haut), de la gauche vers la droite. */
const ANGLES = [170, 148, 126, 108, 72, 54, 32, 10];
const pct = (x: number) => `${Math.round(x * 100)} %`;
const rad = (d: number) => (d * Math.PI) / 180;

function branchGeometry(i: number) {
  const a = rad(ANGLES[i]);
  const sin = Math.sin(a);
  const p0 = { x: TRUNK_X + (i < 4 ? -4 : 4), y: 600 - 260 * sin + (i % 2 ? 0 : 6) };
  const len = 300 + 80 * (1 - sin);
  const dir = { x: Math.cos(a), y: -sin };
  const p2 = { x: p0.x + dir.x * len, y: p0.y + dir.y * len };
  // Une branche monte d'abord, puis s'ouvre vers l'extérieur.
  const p1 = { x: p0.x + dir.x * len * 0.45, y: p0.y + dir.y * len * 0.45 - len * 0.16 };
  return { p0, p1, p2 };
}
const bez = (g: ReturnType<typeof branchGeometry>, t: number): Pt => ({
  x: (1 - t) ** 2 * g.p0.x + 2 * (1 - t) * t * g.p1.x + t * t * g.p2.x,
  y: (1 - t) ** 2 * g.p0.y + 2 * (1 - t) * t * g.p1.y + t * t * g.p2.y
});
const tangent = (g: ReturnType<typeof branchGeometry>, t: number) => {
  const dx = 2 * (1 - t) * (g.p1.x - g.p0.x) + 2 * t * (g.p2.x - g.p1.x);
  const dy = 2 * (1 - t) * (g.p1.y - g.p0.y) + 2 * t * (g.p2.y - g.p1.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
};

const LEAF = "M0 0 C 12 -14, 34 -14, 48 0 C 34 14, 12 14, 0 0 Z";

function leafFill(o: TreeObjective, hue: number, id: string) {
  if (o.medal === "mauve") return MAUVE;
  if (o.progress >= 1) return GOLD;
  if (o.progress <= 0) return "transparent";
  return `url(#${id})`;
}

/** La guerrière, de profil, un genou au sol, la tête inclinée, les deux mains sur la garde de l'épée plantée. */
function Valkyrie() {
  return (
    <g className={s.warrior}>
      {/* Cape */}
      <path d="M404 690 C 368 742, 336 826, 304 898 L 376 898 C 382 858, 390 818, 398 790 Z" className={s.cape} />
      {/* Jambe arrière : genou au sol, pied derrière */}
      <path d="M402 792 L 396 886" className={s.limb} strokeWidth={22} />
      <path d="M394 890 L 340 893" className={s.limb} strokeWidth={15} />
      <path d="M342 893 L 330 880" className={s.limb} strokeWidth={9} />
      {/* Jambe avant : genou levé */}
      <path d="M414 790 L 466 800" className={s.limb} strokeWidth={22} />
      <path d="M467 802 L 470 890" className={s.limb} strokeWidth={16} />
      <path d="M462 894 L 490 896" className={s.limb} strokeWidth={9} />
      {/* Torse en armure */}
      <path d="M398 690 Q 428 680 438 704 L 428 794 L 386 794 Q 386 732 398 690 Z" className={s.body} />
      <path d="M390 760 L 430 764" className={s.belt} />
      {/* Tresse */}
      <path d="M420 672 Q 394 706 386 754" className={s.braid} />
      {/* Tête inclinée et casque ailé */}
      <circle cx={444} cy={676} r={17} className={s.body} />
      <path d="M425 674 Q 428 651 451 655 Q 465 661 462 675 Q 444 666 425 674 Z" className={s.helmet} />
      <path d="M430 656 C 414 628, 392 608, 360 598 C 372 610, 377 617, 376 624 C 388 624, 395 628, 398 635 C 408 635, 415 641, 418 648 C 423 649, 427 652, 430 656 Z" className={s.wing} />
      <path d="M372 608 C 392 616, 410 632, 424 650" className={s.feather} />
      {/* Bras vers la garde */}
      <path d="M420 704 Q 458 730 492 738" className={s.limb} strokeWidth={13} />
      <path d="M414 716 Q 452 748 490 750" className={s.limb} strokeWidth={12} />
      {/* Épée : lame plantée, garde et pommeau dorés */}
      <path d="M495 758 L 505 758 L 504 882 L 500 900 L 496 882 Z" className={s.blade} />
      <rect x={496} y={716} width={8} height={40} rx={3} className={s.grip} />
      <rect x={470} y={752} width={60} height={8} rx={4} fill={GOLD} />
      <circle cx={500} cy={712} r={8} fill={GOLD} />
      <circle cx={494} cy={738} r={8} className={s.hand} />
      <circle cx={492} cy={750} r={8} className={s.hand} />
    </g>
  );
}

export function MandalartTree({ pillars, results, execution }: { pillars: TreePillar[]; results: { progress: number; label: string }; execution: number }) {
  const [sel, setSel] = useState<Sel>(null);
  const geos = useMemo(() => pillars.slice(0, 8).map((_, i) => branchGeometry(i)), [pillars]);
  const panel = useRef<HTMLElement>(null);
  // Au téléphone, le détail est sous l'arbre : on le montre dès qu'on touche une branche ou une feuille.
  useEffect(() => {
    if (sel && window.innerWidth <= 900) panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [sel]);

  const all = pillars.flatMap((p) => p.objectives);
  const grown = all.filter((o) => o.progress > 0).length;
  const golden = all.filter((o) => o.progress >= 1 || o.medal === "mauve").length;

  const P = sel ? pillars[sel.pillar] : null;
  const O = P && sel?.objective !== null && sel?.objective !== undefined ? P.objectives[sel.objective] : null;

  const ringR = 44;
  const ringC = 2 * Math.PI * ringR;

  return (
    <div className={s.wrap}>
      <p className={s.headline}>
        <span>
          <strong>{grown}</strong> feuille{grown > 1 ? "s" : ""} poussée{grown > 1 ? "s" : ""} sur {all.length}
        </span>
        <span>
          <strong style={{ color: GOLD }}>{golden}</strong> dorée{golden > 1 ? "s" : ""}
        </span>
        <span>
          exécution <strong>{pct(execution)}</strong>
        </span>
      </p>

      <div className={s.layout}>
        <svg viewBox="40 20 920 900" className={s.svg} role="img" aria-label={`L'arbre du Mandalart : ${grown} objectifs commencés sur ${all.length}, ${golden} réussis.`}>
          <defs>
            {pillars.slice(0, 8).flatMap((p, i) =>
              p.objectives.map((o) => (
                <linearGradient key={o.code} id={`lf-${o.code.replace(/\W/g, "")}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset={o.progress} stopColor={`hsl(${HUES[i]} 70% 62%)`} />
                  <stop offset={o.progress} stopColor={`hsl(${HUES[i]} 30% 40% / 0.18)`} />
                </linearGradient>
              ))
            )}
            <radialGradient id="tree-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor={GOLD} stopOpacity={0.35} />
              <stop offset="1" stopColor={GOLD} stopOpacity={0} />
            </radialGradient>
            <linearGradient id="tree-ground" x1="0" x2="1">
              <stop offset="0" stopColor="#fff" stopOpacity={0} />
              <stop offset="0.5" stopColor="#fff" stopOpacity={0.16} />
              <stop offset="1" stopColor="#fff" stopOpacity={0} />
            </linearGradient>
          </defs>

          <line x1={160} x2={840} y1={900} y2={900} stroke="url(#tree-ground)" strokeWidth={2} />

          {/* Le tronc sort du pommeau et monte jusqu'à la couronne. */}
          <path d="M486 716 C 490 600, 493 430, 497 160 L 503 160 C 507 430, 510 600, 514 716 Z" className={s.trunk} />
          <path d="M490 712 Q 476 716 470 732 M510 712 Q 524 716 530 732 M494 700 Q 484 696 478 684" fill="none" stroke="hsl(28 22% 36%)" strokeWidth={4} strokeLinecap="round" />

          {/* Les 8 branches */}
          {pillars.slice(0, 8).map((p, i) => {
            const g = geos[i];
            const d = `M${g.p0.x} ${g.p0.y} Q ${g.p1.x} ${g.p1.y} ${g.p2.x} ${g.p2.y}`;
            const active = sel?.pillar === i;
            const dim = sel && !active;
            return (
              <g key={p.code} className={s.branch} data-dim={dim || undefined} onClick={() => setSel({ pillar: i, objective: null })}>
                <path d={d} className={s.hit} />
                <path d={d} fill="none" strokeLinecap="round" stroke={`hsl(${HUES[i]} ${25 + 45 * p.progress}% ${34 + 22 * p.progress}%)`} strokeWidth={5 + 7 * p.progress + (active ? 2 : 0)} />
                <title>{`Pilier ${p.code.slice(1)} · ${p.name} · ${pct(p.progress)}`}</title>
              </g>
            );
          })}

          {/* Les 64 feuilles */}
          {pillars.slice(0, 8).map((p, i) =>
            p.objectives.slice(0, 8).map((o, j) => {
              const g = geos[i];
              const t = 0.3 + j * (0.7 / 7);
              const at = bez(g, t);
              const side = j === 7 ? 0 : j % 2 ? 1 : -1;
              const angle = tangent(g, t) + side * 50;
              const id = `lf-${o.code.replace(/\W/g, "")}`;
              const selected = sel?.pillar === i && sel.objective === j;
              const dim = sel && sel.pillar !== i;
              const golden = o.progress >= 1 || o.medal === "mauve";
              return (
                <g
                  key={o.code}
                  className={s.leaf}
                  data-dim={dim || undefined}
                  transform={`translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) rotate(${angle.toFixed(1)})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSel({ pillar: i, objective: j });
                  }}
                >
                  <circle cx={26} cy={0} r={26} className={s.hit} />
                  {golden ? <circle cx={26} cy={0} r={30} fill="url(#tree-glow)" /> : null}
                  <path
                    d={LEAF}
                    fill={leafFill(o, HUES[i], id)}
                    stroke={selected ? "#fff" : o.progress > 0 ? `hsl(${HUES[i]} 60% 70% / 0.8)` : "rgba(235,235,245,0.28)"}
                    strokeWidth={selected ? 2.5 : 1.3}
                  />
                  <path d="M3 0 L 42 0" stroke={o.progress > 0 ? "rgba(0,0,0,0.22)" : "rgba(235,235,245,0.14)"} strokeWidth={1} />
                  {o.overdue ? <circle cx={8} cy={-8} r={4.5} fill="#ff7b7b" stroke="#0b0a0f" strokeWidth={1.5} /> : null}
                  <title>{`${o.code} · ${o.name} · ${pct(o.progress)}${o.overdue ? ` · ${o.overdue} en retard` : ""}`}</title>
                </g>
              );
            })
          )}

          {/* La couronne : le but de 1,5 M$ */}
          <g className={s.crown} onClick={() => setSel(null)}>
            <circle cx={500} cy={112} r={ringR + 14} fill="url(#tree-glow)" />
            <circle cx={500} cy={112} r={ringR} fill="#16141c" stroke="rgba(242,193,78,0.22)" strokeWidth={7} />
            <circle
              cx={500}
              cy={112}
              r={ringR}
              fill="none"
              stroke={GOLD}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(0.01, results.progress) * ringC} ${ringC}`}
              transform="rotate(-90 500 112)"
            />
            <text x={500} y={110} textAnchor="middle" className={s.crownGoal}>
              1,5 M$
            </text>
            <text x={500} y={130} textAnchor="middle" className={s.crownSub}>
              {pct(results.progress)}
            </text>
            <title>{`1,5 M$ encaissés en 2028 · ${results.label}`}</title>
          </g>

          <Valkyrie />
        </svg>

        <aside ref={panel} className={s.panel} aria-live="polite">
          {!P ? (
            <>
              <h2 className={s.h2}>Les 8 piliers</h2>
              <p className={s.muted}>Touche une branche ou une feuille pour voir le détail.</p>
              <ul className={s.list}>
                {pillars.map((p, i) => (
                  <li key={p.code}>
                    <button type="button" className={s.row} onClick={() => setSel({ pillar: i, objective: null })}>
                      <span className={s.dot} style={{ background: `hsl(${HUES[i]} 70% 62%)` }} />
                      <span className={s.rowName}>{p.name}</span>
                      <span className={s.rowPct}>{pct(p.progress)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className={s.legend}>
                <span>
                  <i style={{ border: "1px solid rgba(235,235,245,0.35)" }} /> pas commencée
                </span>
                <span>
                  <i style={{ background: "linear-gradient(90deg, hsl(268 70% 62%) 50%, transparent 50%)" }} /> se remplit
                </span>
                <span>
                  <i style={{ background: GOLD }} /> réussie
                </span>
                <span>
                  <i style={{ background: MAUVE }} /> indicateurs atteints
                </span>
                <span>
                  <i style={{ background: "#ff7b7b", borderRadius: 999 }} /> en retard
                </span>
              </p>
              <p className={s.muted}>Couronne : {results.label}.</p>
            </>
          ) : !O ? (
            <>
              <button type="button" className={s.back} onClick={() => setSel(null)}>
                ← Tout l&apos;arbre
              </button>
              <p className={s.eyebrow} style={{ color: `hsl(${HUES[sel!.pillar]} 70% 70%)` }}>
                Pilier {P.code.slice(1)}
              </p>
              <h2 className={s.h2}>{P.name}</h2>
              <p className={s.big}>{pct(P.progress)}</p>
              <p className={s.muted}>
                {P.objectives.filter((o) => o.progress > 0).length} feuilles poussées sur {P.objectives.length}
                {P.starsOpen ? ` · ${P.starsOpen} ⭐ ouvertes` : ""}
                {P.overdue ? ` · ${P.overdue} en retard` : ""}
              </p>
              <ul className={s.list}>
                {P.objectives.map((o, j) => (
                  <li key={o.code}>
                    <button type="button" className={s.row} onClick={() => setSel({ pillar: sel!.pillar, objective: j })}>
                      <span className={s.bar}>
                        <span style={{ width: pct(o.progress), background: o.medal === "mauve" ? MAUVE : o.progress >= 1 ? GOLD : `hsl(${HUES[sel!.pillar]} 70% 62%)` }} />
                      </span>
                      <span className={s.rowName}>{o.name}</span>
                      <span className={s.rowPct}>
                        {o.overdue ? <span className={s.late}>{o.overdue}</span> : null}
                        {pct(o.progress)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Link href={`/admin/mandalart/piliers/${P.code.toLowerCase()}`} className="admin-btn-ghost" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
                Ouvrir le pilier
              </Link>
            </>
          ) : (
            <>
              <button type="button" className={s.back} onClick={() => setSel({ pillar: sel!.pillar, objective: null })}>
                ← {P.name}
              </button>
              <p className={s.eyebrow} style={{ color: `hsl(${HUES[sel!.pillar]} 70% 70%)` }}>
                Objectif {O.code.slice(1)}
              </p>
              <h2 className={s.h2}>{O.name}</h2>
              <p className={s.big} style={{ color: O.medal === "mauve" ? MAUVE : O.progress >= 1 ? GOLD : undefined }}>
                {pct(O.progress)}
              </p>
              <p className={s.muted}>
                {O.done} tâche{O.done > 1 ? "s" : ""} faite{O.done > 1 ? "s" : ""} sur {O.total}
                {O.overdue ? ` · ${O.overdue} en retard` : ""}
                {O.medal === "mauve" ? " · indicateurs atteints 💜" : O.progress >= 1 ? " · réussi 🥇" : ""}
              </p>
              <ul className={s.tasks}>
                {O.tasks.map((t) => (
                  <li key={t.code} data-status={t.status}>
                    <span className={s.check} aria-label={t.status === "fait" ? "Fait" : t.status === "en_cours" ? "En cours" : "À faire"}>
                      {t.status === "fait" ? "✓" : t.status === "en_cours" ? "◐" : ""}
                    </span>
                    <span className={s.taskTitle}>
                      {t.star ? "⭐ " : ""}
                      {t.title}
                    </span>
                    {t.due && t.status !== "fait" ? <span className={t.overdue ? s.lateText : s.due}>{t.due.slice(5).replace("-", "/")}</span> : null}
                  </li>
                ))}
                {O.tasks.length === 0 ? <li className={s.muted}>Aucune tâche dans cet objectif.</li> : null}
              </ul>
              <Link href={`/admin/mandalart/piliers/${P.code.toLowerCase()}`} className="admin-btn-ghost" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
                Cocher des tâches
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

import Link from "next/link";

import type { PillarProgress } from "@/lib/mandalart-core";

/** Une couleur par pilier, toutes de même clarté pour un ensemble harmonieux (teinte en degrés). */
const HUES = [268, 222, 186, 150, 42, 18, 340, 300];
/** Positions de la grille 3 × 3 (4 = le centre) occupées par les 8 piliers, dans l'ordre du plan. */
const AROUND = [0, 1, 2, 3, 5, 6, 7, 8];
const MEDAL: Record<string, string> = { bronze: "🥉", argent: "🥈", or: "🥇", mauve: "💜" };
const pct = (x: number) => `${Math.round(x * 100)} %`;

type Pillar = PillarProgress;

function ObjectiveCell({ o, hue, href }: { o: Pillar["objectives"][number]; hue: number; href: string }) {
  return (
    <Link href={href} className="mdb-obj" style={{ "--h": hue, "--p": `${Math.round(o.progress * 100)}%` } as React.CSSProperties} title={`${o.code} · ${o.name} · ${pct(o.progress)}`}>
      <span className="mdb-obj-name">{o.name}</span>
      <span className="mdb-obj-foot">
        <span>{pct(o.progress)}</span>
        {o.medal ? <span aria-label={`Médaille ${o.medal}`}>{MEDAL[o.medal]}</span> : null}
        {o.overdue ? <span className="mdb-late" aria-label={`${o.overdue} en retard`}>{o.overdue}</span> : null}
      </span>
    </Link>
  );
}

function PillarCell({ p, hue, href, big = false }: { p: Pillar; hue: number; href: string; big?: boolean }) {
  return (
    <Link href={href} className="mdb-pillar" data-big={big || undefined} title={`Pilier ${p.code.slice(1)} · ${p.name} · ${pct(p.progress)}${p.starsOpen ? ` · ${p.starsOpen} ⭐ ouvertes` : ""}${p.overdue ? ` · ${p.overdue} en retard` : ""}`} style={{ "--h": hue, "--p": `${Math.round(p.progress * 100)}%` } as React.CSSProperties}>
      <span className="mdb-pillar-code">Pilier {p.code.slice(1)}</span>
      <span className="mdb-pillar-name">{p.name}</span>
      <span className="mdb-pillar-foot">
        <span className="mdb-ring" aria-hidden />
        <span>{pct(p.progress)}</span>
        {big && p.starsOpen ? <span>{p.starsOpen} ⭐</span> : null}
        {big && p.overdue ? <span className="mdb-late">{p.overdue}</span> : null}
      </span>
    </Link>
  );
}

/** Le Mandalart complet : la case centrale entourée des 8 piliers, et chaque pilier au centre de ses 8 objectifs. */
export function MandalartBoard({ pillars, center }: { pillars: Pillar[]; center: React.ReactNode }) {
  const href = (p: Pillar) => `/admin/mandalart/piliers/${p.code.toLowerCase()}`;
  const blocks: React.ReactNode[] = Array.from({ length: 9 }, () => null);

  // Bloc central : la case centrale et les 8 piliers.
  const centerCells: React.ReactNode[] = Array.from({ length: 9 }, () => null);
  centerCells[4] = <div key="c" className="mdb-center">{center}</div>;
  pillars.slice(0, 8).forEach((p, i) => {
    centerCells[AROUND[i]] = <PillarCell key={p.code} p={p} hue={HUES[i]} href={href(p)} />;
  });
  blocks[4] = (
    <section key="centre" className="mdb-block" data-center aria-label="La case centrale et les 8 piliers">
      {centerCells}
    </section>
  );

  // Les 8 blocs autour : chaque pilier au centre de ses 8 objectifs, dans la même direction que sur le bloc central.
  pillars.slice(0, 8).forEach((p, i) => {
    const cells: React.ReactNode[] = Array.from({ length: 9 }, () => null);
    cells[4] = <PillarCell key="p" p={p} hue={HUES[i]} href={href(p)} big />;
    p.objectives.slice(0, 8).forEach((o, j) => {
      cells[AROUND[j]] = <ObjectiveCell key={o.code} o={o} hue={HUES[i]} href={href(p)} />;
    });
    blocks[AROUND[i]] = (
      <section key={p.code} className="mdb-block" style={{ "--h": HUES[i] } as React.CSSProperties} aria-label={`Pilier ${p.code.slice(1)} : ${p.name}`}>
        {cells}
      </section>
    );
  });

  return (
    <div className="mdb-wrap">
      <div className="mdb">{blocks}</div>
    </div>
  );
}

import type { CSSProperties } from "react";

import type { ShotId } from "@/lib/shooting-guide-core";

/** Les types de plans du guide de tournage, dessinés dans un écran de téléphone vertical (9:16).
 *  Couleurs par les jetons de l'admin : lisible en mode jour et en mode nuit. */

const ink: CSSProperties = { stroke: "var(--adm-text-2)", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
const thin: CSSProperties = { stroke: "var(--adm-border)", strokeWidth: 1, fill: "none" };
const jersey: CSSProperties = { fill: "var(--adm-accent)", stroke: "none" };
const skin: CSSProperties = { fill: "var(--adm-surface-3)", stroke: "var(--adm-text-2)", strokeWidth: 1.4 };
const ballStyle: CSSProperties = { fill: "var(--adm-surface)", stroke: "var(--adm-text)", strokeWidth: 1.4 };
const soft: CSSProperties = { fill: "var(--adm-accent-soft)", stroke: "none" };
const label: CSSProperties = { fill: "var(--adm-text-3)", fontSize: 7, fontFamily: "inherit", fontWeight: 600 };

/** Une joueuse debout ; (x, y) = ses pieds, s = échelle (1 = 60 de haut). */
function Player({ x, y, s = 1, armsUp = false, opacity = 1 }: { x: number; y: number; s?: number; armsUp?: boolean; opacity?: number }) {
  const u = (n: number) => n * s;
  return (
    <g opacity={opacity}>
      <line x1={x - u(4)} y1={y - u(24)} x2={x - u(6)} y2={y} style={{ ...ink, strokeWidth: Math.max(1, 2.2 * s) }} />
      <line x1={x + u(4)} y1={y - u(24)} x2={x + u(7)} y2={y} style={{ ...ink, strokeWidth: Math.max(1, 2.2 * s) }} />
      <rect x={x - u(8)} y={y - u(46)} width={u(16)} height={u(23)} rx={u(4)} style={jersey} />
      {armsUp ? (
        <>
          <line x1={x - u(7)} y1={y - u(43)} x2={x - u(14)} y2={y - u(60)} style={{ ...ink, strokeWidth: Math.max(1, 2 * s) }} />
          <line x1={x + u(7)} y1={y - u(43)} x2={x + u(14)} y2={y - u(60)} style={{ ...ink, strokeWidth: Math.max(1, 2 * s) }} />
        </>
      ) : (
        <>
          <line x1={x - u(8)} y1={y - u(42)} x2={x - u(12)} y2={y - u(28)} style={{ ...ink, strokeWidth: Math.max(1, 2 * s) }} />
          <line x1={x + u(8)} y1={y - u(42)} x2={x + u(12)} y2={y - u(28)} style={{ ...ink, strokeWidth: Math.max(1, 2 * s) }} />
        </>
      )}
      <circle cx={x} cy={y - u(53)} r={u(6.5)} style={{ ...skin, strokeWidth: Math.max(0.8, 1.4 * s) }} />
    </g>
  );
}

const Ball = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g>
    <circle cx={x} cy={y} r={r} style={ballStyle} />
    <path d={`M ${x - r * 0.35} ${y - r * 0.2} l ${r * 0.35} ${-r * 0.25} l ${r * 0.35} ${r * 0.25} l ${-r * 0.13} ${r * 0.4} h ${-r * 0.44} z`} style={{ fill: "var(--adm-text)", stroke: "none" }} />
  </g>
);

const Cone = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => <path d={`M ${x - 3 * s} ${y} L ${x} ${y - 6 * s} L ${x + 3 * s} ${y} Z`} style={{ fill: "var(--adm-series-2)", stroke: "none" }} />;

function Scene({ id }: { id: ShotId }) {
  switch (id) {
    case "large":
      return (
        <>
          <path d="M 4 70 L 86 70" style={thin} />
          <path d="M 30 70 L 14 150 M 60 70 L 76 150 M 45 70 L 45 150" style={thin} />
          <rect x={32} y={56} width={26} height={14} style={{ ...thin, stroke: "var(--adm-text-3)" }} />
          {[
            [24, 92],
            [46, 88],
            [66, 96],
            [32, 118],
            [58, 122],
            [44, 140]
          ].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <Player x={x} y={y} s={0.32} />
              <Ball x={x + 4} y={y - 1} r={1.6} />
            </g>
          ))}
          <Cone x={16} y={104} s={0.7} />
          <Cone x={74} y={110} s={0.7} />
          <Cone x={20} y={132} s={0.7} />
          <Cone x={72} y={138} s={0.7} />
        </>
      );
    case "moyen":
      return (
        <>
          <Player x={42} y={196} s={2.6} />
          <Ball x={70} y={152} r={8} />
        </>
      );
    case "serre":
      return (
        <>
          <path d="M 8 160 Q 10 118 45 112 Q 80 118 82 160 Z" style={jersey} />
          <circle cx={45} cy={78} r={28} style={skin} />
          <path d="M 18 70 Q 24 44 45 44 Q 68 44 72 70 Q 64 56 45 56 Q 26 56 18 70 Z" style={{ fill: "var(--adm-text-2)", stroke: "none" }} />
          <circle cx={36} cy={78} r={2.2} style={{ fill: "var(--adm-text)" }} />
          <circle cx={54} cy={78} r={2.2} style={{ fill: "var(--adm-text)" }} />
          <path d="M 36 92 Q 45 99 54 92" style={ink} />
        </>
      );
    case "pieds":
      return (
        <>
          <path d="M 0 132 L 90 120" style={thin} />
          <path d="M 14 22 L 22 100" style={{ ...ink, strokeWidth: 9 }} />
          <path d="M 8 104 Q 10 94 24 96 L 40 104 Q 44 112 34 114 L 12 114 Q 6 112 8 104 Z" style={{ fill: "var(--adm-text-2)", stroke: "none" }} />
          <path d="M 62 10 L 66 106" style={{ ...ink, strokeWidth: 9 }} />
          <path d="M 56 110 Q 58 100 70 102 L 84 110 Q 88 118 78 120 L 60 120 Q 54 118 56 110 Z" style={{ fill: "var(--adm-text-2)", stroke: "none" }} />
          <Ball x={46} y={124} r={15} />
        </>
      );
    case "ralenti":
      return (
        <>
          <Player x={28} y={130} s={1.2} opacity={0.2} />
          <Player x={40} y={130} s={1.2} opacity={0.45} />
          <Player x={52} y={130} s={1.2} />
          <path d="M 30 128 Q 50 120 70 126" style={{ ...ink, strokeDasharray: "2 3" }} />
          <Ball x={70} y={126} r={4.5} />
          <text x={45} y={30} textAnchor="middle" style={{ ...label, fontSize: 10, fill: "var(--adm-accent)" }}>
            120 i/s
          </text>
        </>
      );
    case "pov":
      return (
        <>
          <path d="M 45 40 L 0 160 M 45 40 L 90 160" style={thin} />
          <Cone x={38} y={62} s={0.8} />
          <Cone x={52} y={74} s={1} />
          <Cone x={36} y={92} s={1.3} />
          <Cone x={56} y={112} s={1.6} />
          <path d="M 6 160 Q 8 138 24 140 L 28 160 Z" style={{ fill: "var(--adm-text-2)", stroke: "none" }} />
          <path d="M 84 160 Q 82 138 66 140 L 62 160 Z" style={{ fill: "var(--adm-text-2)", stroke: "none" }} />
          <Ball x={45} y={138} r={12} />
        </>
      );
    case "reaction":
      return (
        <>
          <Player x={26} y={150} s={1.5} armsUp />
          <Player x={64} y={150} s={1.5} armsUp />
          <path d="M 45 40 L 45 30 M 36 44 L 30 36 M 54 44 L 60 36" style={{ ...ink, stroke: "var(--adm-accent)", strokeWidth: 2 }} />
        </>
      );
    case "entrevue":
      return (
        <>
          <rect x={0} y={0} width={90} height={160} style={soft} />
          <path d="M 30 0 V 160 M 60 0 V 160 M 0 53 H 90 M 0 107 H 90" style={{ ...thin, strokeDasharray: "2 3" }} />
          <path d="M 4 160 Q 6 112 30 106 Q 54 112 56 160 Z" style={jersey} />
          <circle cx={30} cy={78} r={20} style={skin} />
          <circle cx={36} cy={120} r={2.4} style={{ fill: "var(--adm-text)" }} />
          <path d="M 52 74 L 84 70" style={{ ...ink, strokeDasharray: "3 3" }} />
          <path d="M 80 66 L 85 70 L 80 74" style={ink} />
          <text x={86} y={60} textAnchor="end" style={label}>
            regard
          </text>
        </>
      );
    case "ambiance":
      return (
        <>
          {[14, 34, 56, 76].map((x) => (
            <g key={x}>
              <line x1={x} y1={0} x2={x} y2={10} style={thin} />
              <circle cx={x} cy={14} r={4} style={{ fill: "var(--adm-warn-soft)", stroke: "var(--adm-warn)", strokeWidth: 1 }} />
            </g>
          ))}
          <path d="M 0 96 L 90 96" style={thin} />
          {[12, 26, 40, 54, 68, 82].map((x) => (
            <Ball key={x} x={x} y={104} r={6} />
          ))}
          <rect x={10} y={124} width={30} height={22} rx={5} style={{ fill: "var(--adm-surface-3)", stroke: "var(--adm-text-3)", strokeWidth: 1.2 }} />
          <path d="M 18 124 Q 25 114 32 124" style={ink} />
          <Player x={66} y={158} s={0.5} opacity={0.7} />
          <Cone x={54} y={150} s={1} />
        </>
      );
  }
}

export function ShotDiagram({ id, title }: { id: ShotId; title: string }) {
  const clip = `shot-clip-${id}`;
  return (
    <svg viewBox="0 0 90 160" width="100%" role="img" aria-label={title} style={{ display: "block", maxWidth: 120, margin: "0 auto" }}>
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={90} height={160} rx={10} />
        </clipPath>
      </defs>
      <rect x={0} y={0} width={90} height={160} rx={10} style={{ fill: "var(--adm-surface-2)" }} />
      <g clipPath={`url(#${clip})`}>
        <Scene id={id} />
      </g>
      <rect x={0.75} y={0.75} width={88.5} height={158.5} rx={10} style={{ fill: "none", stroke: "var(--adm-border)", strokeWidth: 1.5 }} />
    </svg>
  );
}

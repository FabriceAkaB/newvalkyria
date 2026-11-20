"use client";

import { useState } from "react";

/** Graphiques du sondage de fin (JP, 20 nov. 2026) : cercles des moyennes, courbes par semaine, aide des coachs.
 *  Couleurs par jetons (--adm-series-1 / -2, vérifiés daltonisme et contraste en Jour et en Nuit). */

const fr = (n: number | null, digits = 1) => (n === null ? "—" : n.toLocaleString("fr-CA", { maximumFractionDigits: digits }));
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const weekLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

/** Un cercle : la valeur sur son maximum (10 ou 100 %). */
export function SurveyRing({ value, max, unit, label, detail, color = "var(--adm-series-1)" }: { value: number | null; max: number; unit: string; label: string; detail?: string; color?: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const share = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <div className="mda-card svc-ring">
      <svg viewBox="0 0 112 112" role="img" aria-label={`${label} : ${value === null ? "pas de réponse" : `${fr(value)}${unit}`}`}>
        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--adm-surface-3)" strokeWidth="10" />
        {value !== null ? <circle cx="56" cy="56" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${share * c} ${c}`} transform="rotate(-90 56 56)" /> : null}
        <text x="56" y="58" textAnchor="middle" className="svc-ring-value">{fr(value, unit === " %" ? 0 : 1)}</text>
        <text x="56" y="76" textAnchor="middle" className="svc-ring-unit">{unit === " %" ? "%" : `sur ${max}`}</text>
      </svg>
      <p className="mda-label" style={{ color: "var(--adm-text)", fontWeight: 600 }}>{label}</p>
      {detail ? <p style={{ fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{detail}</p> : null}
    </div>
  );
}

interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

/** Courbes par semaine sur un seul axe (0 à max), survol : la semaine, chaque valeur et le nombre de réponses. */
export function SurveyLines({ weeks, series, max, unit = "", counts }: { weeks: string[]; series: Series[]; max: number; unit?: string; counts?: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const L = 28;
  const R = 92; // place des étiquettes en bout de courbe
  const T = 10;
  const B = 26;
  const x = (i: number) => (weeks.length <= 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (weeks.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const ticks = max === 10 ? [0, 5, 10] : [0, 50, 100];
  // Étiquettes de bout de courbe : écartées si elles se chevauchent.
  const ends = series
    .map((s) => {
      const i = s.values.map((v, k) => (v === null ? -1 : k)).filter((k) => k >= 0).pop();
      return i === undefined ? null : { s, i, v: s.values[i] as number, ty: y(s.values[i] as number) };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.ty - b.ty);
  for (let k = 1; k < ends.length; k++) if (ends[k].ty - ends[k - 1].ty < 16) ends[k].ty = ends[k - 1].ty + 16;
  const step = weeks.length > 1 ? (W - L - R) / (weeks.length - 1) : W - L - R;

  return (
    <div className="svc-chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.label).join(" et ") + " par semaine"}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R + 8} y1={y(t)} y2={y(t)} stroke="var(--adm-line)" strokeWidth="1" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="svc-axis">{t}</text>
          </g>
        ))}
        {weeks.map((w, i) =>
          weeks.length <= 6 || i % Math.ceil(weeks.length / 6) === 0 || i === weeks.length - 1 ? (
            <text key={w} x={x(i)} y={H - 6} textAnchor="middle" className="svc-axis">{weekLabel(w)}</text>
          ) : null
        )}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--adm-border)" strokeWidth="1" /> : null}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean);
          return (
            <g key={s.key}>
              {pts.length > 1 ? <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null}
              {s.values.map((v, i) => (v === null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.color} stroke="var(--adm-surface)" strokeWidth="2" />))}
            </g>
          );
        })}
        {ends.map((e) => (
          <text key={e.s.key} x={x(e.i) + 10} y={e.ty + 4} className="svc-axis" style={{ fill: "var(--adm-text-2)", fontWeight: 600 }}>
            {e.s.label} {fr(e.v, unit ? 0 : 1)}{unit}
          </text>
        ))}
        {weeks.map((w, i) => (
          <rect key={w} x={x(i) - step / 2} y={0} width={Math.max(step, 24)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`Semaine du ${weekLabel(w)}`} />
        ))}
      </svg>
      {hover !== null ? (
        <div className="svc-tip" style={{ left: `${Math.min(85, Math.max(15, (x(hover) / W) * 100))}%` }}>
          <strong>Semaine du {weekLabel(weeks[hover])}</strong>
          {series.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="svc-swatch" style={{ background: s.color }} />
              {s.label} : {fr(s.values[hover], unit ? 0 : 1)}{s.values[hover] === null ? "" : unit}
            </div>
          ))}
          {counts ? <div style={{ color: "var(--adm-text-3)", marginTop: 2 }}>{counts[hover]} réponse{counts[hover] > 1 ? "s" : ""}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

/** L'aide de chaque coach : la part des filles de ses pratiques qui l'ont nommée. */
export function CoachHelpBars({ coaches }: { coaches: { coachId: string; name: string; practices: number; asked: number; named: number; pct: number }[] }) {
  return (
    <ul className="svc-bars">
      {coaches.map((c) => (
        <li key={c.coachId} className="svc-bar-row" title={`${c.name} : nommée par ${c.named} fille${c.named > 1 ? "s" : ""} sur ${c.asked}, en ${c.practices} pratique${c.practices > 1 ? "s" : ""}`}>
          <span style={{ fontWeight: 600 }}>
            {c.name}
            <small>{c.practices} pratique{c.practices > 1 ? "s" : ""}</small>
          </span>
          <span className="svc-bar-track" aria-hidden>
            <span className="svc-bar-fill" style={{ width: `${c.pct}%`, display: "block" }} />
          </span>
          <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
            {c.pct} %
            <small>{c.named} sur {c.asked}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

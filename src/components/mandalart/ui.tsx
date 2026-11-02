import type { Medal } from "@/lib/mandalart-core";

/** Petits éléments visuels partagés par les écrans du Mandalart (barres, médailles, pastilles). */

export const moneyDollars = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${Math.round(n).toLocaleString("fr-CA")} $`;

export const moneyCents = (c: number | null | undefined) => (c === null || c === undefined ? "—" : moneyDollars(c / 100));

export const pctLabel = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)} %`);

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

export function shortDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]}`;
}

export function monthLabel(ym: string, long = true): string {
  const [y, m] = ym.split("-").map(Number);
  return `${long ? MONTHS_LONG[m - 1] : MONTHS[m - 1]} ${y}`;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Bar({ value, marker, thin, color, floor }: { value: number; marker?: number; thin?: boolean; color?: string; floor?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`mda-bar${thin ? " mda-bar-thin" : ""}`} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      {floor !== undefined ? <span className="mda-fill-floor" style={{ width: `${Math.min(100, floor * 100)}%` }} /> : null}
      <span className="mda-fill" style={{ width: `${v * 100}%`, background: color }} />
      {marker !== undefined ? <span className="mda-marker" style={{ left: `${Math.min(100, marker * 100)}%` }} /> : null}
    </div>
  );
}

export const MEDAL_LABEL: Record<Exclude<Medal, null>, string> = { bronze: "Bronze (25 %)", argent: "Argent (50 %)", or: "Or (100 %)", mauve: "Mauve (cibles atteintes)" };

export function MedalDot({ medal }: { medal: Medal }) {
  if (!medal) return null;
  return <span className="mda-medal" data-m={medal} title={MEDAL_LABEL[medal]} aria-label={MEDAL_LABEL[medal]} />;
}

export function MedalCounts({ medals }: { medals: Record<"bronze" | "argent" | "or" | "mauve", number> }) {
  const order = ["mauve", "or", "argent", "bronze"] as const;
  const any = order.some((m) => medals[m] > 0);
  if (!any) return <span className="mda-muted" style={{ fontSize: "0.78rem" }}>Aucune médaille</span>;
  return (
    <span className="mda-medals">
      {order.map((m) =>
        medals[m] > 0 ? (
          <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.78rem", color: "var(--adm-text-2)" }}>
            <span className="mda-medal" data-m={m} title={MEDAL_LABEL[m]} />
            {medals[m]}
          </span>
        ) : null
      )}
    </span>
  );
}

export function Pill({ tone, children }: { tone?: "good" | "warn" | "bad" | "info" | "accent"; children: React.ReactNode }) {
  return (
    <span className="mda-pill" data-tone={tone}>
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, "good" | "warn" | "info" | undefined> = { actif: "good", partiel: "warn", "a-construire": undefined };

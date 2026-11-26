/** « Ma paie » de l'éducateur (JP, 18 nov. 2026) : ce qu'il a déjà gagné dans la période de paie en cours, ce qui est
 *  retenu (présence ou rapport à faire), ce qui est prévu d'ici la fin de la période, les retenues de l'académie (réglées
 *  dans app_settings « coach_pay_deductions », aucune par défaut) et le net qui tombera dans sa poche. Règles pures. */

export interface PayLine {
  activityId: string;
  date: string;
  start: string;
  end: string;
  label: string;
  hours: number;
  cents: number;
  state: "compte" | "retenu" | "prevu" | "absent";
  /** Pourquoi c'est retenu (ex. « rapport à faire »). */
  why?: string | null;
  /** Déjà versé (séance marquée payée dans l'admin). */
  paid?: boolean;
}

export interface Deduction {
  label: string;
  /** Pourcentage du brut (ex. 0.05 pour 5 %). */
  rate: number;
}

export interface PaySummary {
  earnedCents: number;
  heldCents: number;
  plannedCents: number;
  hoursEarned: number;
  hoursHeld: number;
  hoursPlanned: number;
  deductions: { label: string; cents: number }[];
  netCents: number;
  /** Net si tout ce qui est retenu et prévu est fait. */
  netIfAllCents: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round2 = (h: number) => Math.round(h * 100) / 100;

export function summarizePay(lines: PayLine[], deductions: Deduction[]): PaySummary {
  const of = (s: PayLine["state"]) => lines.filter((l) => l.state === s);
  const earnedCents = sum(of("compte").map((l) => l.cents));
  const heldCents = sum(of("retenu").map((l) => l.cents));
  const plannedCents = sum(of("prevu").map((l) => l.cents));
  const cut = (gross: number) => deductions.map((d) => ({ label: d.label, cents: Math.round(gross * d.rate) }));
  const ded = cut(earnedCents);
  const all = earnedCents + heldCents + plannedCents;
  return {
    earnedCents,
    heldCents,
    plannedCents,
    hoursEarned: round2(sum(of("compte").map((l) => l.hours))),
    hoursHeld: round2(sum(of("retenu").map((l) => l.hours))),
    hoursPlanned: round2(sum(of("prevu").map((l) => l.hours))),
    deductions: ded,
    netCents: earnedCents - sum(ded.map((d) => d.cents)),
    netIfAllCents: all - sum(cut(all).map((d) => d.cents))
  };
}

/** Lecture prudente du réglage des retenues (liste { label, rate } avec 0 < rate < 1). */
export function parseDeductions(raw: unknown): Deduction[] {
  const v = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  return Array.isArray(v) ? v.filter((d) => d && typeof d.label === "string" && typeof d.rate === "number" && d.rate > 0 && d.rate < 1) : [];
}

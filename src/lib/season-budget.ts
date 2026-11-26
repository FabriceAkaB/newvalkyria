/** Cumul d'une saison (JP, 26 nov. 2026) : les scénarios du calculateur de lancement d'une même saison (« Été 2027 »,
 *  « Hiver 2027-2028 ») additionnés, au remplissage choisi ; puis le salaire de JP pour la saison et les autres charges
 *  de la saison, pour savoir ce qu'il peut se verser et ce qui reste dans l'entreprise. Règles pures, sans base. */

import type { LaunchInputs, LaunchResults } from "@/lib/launch-calculator";

export type SeasonFill = "pessimistic" | "method" | "full";

export const SEASON_FILLS: { key: SeasonFill; label: string; rate: number }[] = [
  { key: "pessimistic", label: "70 % (pessimiste)", rate: 0.7 },
  { key: "method", label: "80 % (visé)", rate: 0.8 },
  { key: "full", label: "100 % (plein)", rate: 1 }
];

export const NO_SEASON = "Sans saison";

export interface SeasonSettings {
  /** Salaire de JP pour la saison, coût total pour l'entreprise. */
  jpSalaryCents: number;
  /** Autres charges de la saison qui ne sont dans aucun programme (comptable, logiciels, assurance globale…). */
  otherChargesCents: number;
  fill: SeasonFill;
  /** Scénarios laissés hors du cumul (décochés). */
  excluded: string[];
}

export const DEFAULT_SEASON_SETTINGS: SeasonSettings = { jpSalaryCents: 0, otherChargesCents: 0, fill: "pessimistic", excluded: [] };

const c = (x: unknown) => {
  const n = Math.round(Number(x));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1_000_000_000) : 0;
};

export function normalizeSeasonSettings(raw: unknown): SeasonSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    jpSalaryCents: c(r.jpSalaryCents),
    otherChargesCents: c(r.otherChargesCents),
    fill: SEASON_FILLS.some((f) => f.key === r.fill) ? (r.fill as SeasonFill) : "pessimistic",
    excluded: Array.isArray(r.excluded) ? [...new Set(r.excluded.map(String))].slice(0, 200) : []
  };
}

/** Lit le réglage enregistré (une entrée par saison). */
export function parseSeasonSettingsMap(value: string | null | undefined): Record<string, SeasonSettings> {
  let raw: unknown = null;
  try {
    raw = value ? JSON.parse(value) : null;
  } catch {
    raw = null;
  }
  const out: Record<string, SeasonSettings> = {};
  if (raw && typeof raw === "object") for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k.slice(0, 40)] = normalizeSeasonSettings(v);
  return out;
}

export const seasonOf = (inputs: Pick<LaunchInputs, "season">) => inputs.season.trim() || NO_SEASON;

/** Les saisons présentes dans les scénarios, « Sans saison » en dernier. */
export function seasonLabels(list: { inputs: Pick<LaunchInputs, "season"> }[]): string[] {
  const set = new Set(list.map((s) => seasonOf(s.inputs)));
  return [...set].sort((a, b) => (a === NO_SEASON ? 1 : b === NO_SEASON ? -1 : a.localeCompare(b, "fr")));
}

export interface SeasonLine {
  id: string;
  name: string;
  included: boolean;
  format: LaunchInputs["format"];
  count: number;
  capacity: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  grantCents: number;
  jpHours: number;
}

export interface SeasonTotals {
  lines: SeasonLine[];
  included: number;
  signups: number;
  revenueCents: number;
  grantCents: number;
  costCents: number;
  /** Bénéfice des programmes (revenus − coûts), avant le salaire de JP et les autres charges. */
  programProfitCents: number;
  jpSalaryCents: number;
  otherChargesCents: number;
  /** Ce qui reste dans l'entreprise à la fin de la saison (avant impôts). */
  leftCents: number;
  /** Le plus que JP peut se verser sans laisser l'entreprise dans le rouge (bénéfice − autres charges). */
  maxSalaryCents: number;
  jpHours: number;
  /** Bénéfice des programmes par heure de JP (null sans heures). */
  profitPerJpHourCents: number | null;
  margin: number | null;
}

/** Additionne les scénarios d'une saison au remplissage choisi. */
export function seasonTotals(list: { id: string; name: string; inputs: LaunchInputs; results: LaunchResults }[], settings: SeasonSettings): SeasonTotals {
  const excluded = new Set(settings.excluded);
  const lines: SeasonLine[] = list.map((s) => {
    const sc = s.results.scenarios.find((x) => x.key === settings.fill) ?? s.results.scenarios.find((x) => x.key === "pessimistic");
    return {
      id: s.id,
      name: s.name,
      included: !excluded.has(s.id) && s.results.ready,
      format: s.inputs.format,
      count: sc?.count ?? 0,
      capacity: s.inputs.capacity,
      revenueCents: sc?.revenueCents ?? 0,
      costCents: sc?.costCents ?? 0,
      profitCents: sc?.profitCents ?? 0,
      grantCents: s.results.grantCents,
      jpHours: s.inputs.jpHours
    };
  });
  const inc = lines.filter((l) => l.included);
  const sum = (k: "revenueCents" | "costCents" | "profitCents" | "grantCents" | "count" | "jpHours") => inc.reduce((t, l) => t + l[k], 0);
  const revenueCents = sum("revenueCents");
  const costCents = sum("costCents");
  const programProfitCents = sum("profitCents");
  const jpHours = Math.round(sum("jpHours") * 100) / 100;
  return {
    lines,
    included: inc.length,
    signups: sum("count"),
    revenueCents,
    grantCents: sum("grantCents"),
    costCents,
    programProfitCents,
    jpSalaryCents: settings.jpSalaryCents,
    otherChargesCents: settings.otherChargesCents,
    leftCents: programProfitCents - settings.jpSalaryCents - settings.otherChargesCents,
    maxSalaryCents: Math.max(0, programProfitCents - settings.otherChargesCents),
    jpHours,
    profitPerJpHourCents: jpHours > 0 ? Math.round(programProfitCents / jpHours) : null,
    margin: revenueCents > 0 ? programProfitCents / revenueCents : null
  };
}

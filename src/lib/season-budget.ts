/** Cumul d'une saison (JP, 26 nov. 2026) : les scénarios du calculateur de lancement d'une même saison (« Été 2027 »,
 *  « Hiver 2027-2028 ») additionnés, au remplissage choisi ; puis le salaire de JP pour la saison et les autres charges
 *  de la saison, pour savoir ce qu'il peut se verser et ce qui reste dans l'entreprise. Règles pures, sans base. */

import type { LaunchInputs, LaunchResults } from "@/lib/launch-calculator";

/** Valeur d'une heure de JP par défaut (même cible que les Projets à lancer : 50 $ par heure). */
export const DEFAULT_JP_HOUR_VALUE_CENTS = 5_000;

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
  /** Ce que vaut une heure de JP ailleurs (coût d'opportunité). */
  jpHourValueCents: number;
  /** Saison comptable liée (revenue_expenses.season_key), pour le dépensé à ce jour ; null = pas encore liée. */
  seasonKey: string | null;
}

export const DEFAULT_SEASON_SETTINGS: SeasonSettings = { jpSalaryCents: 0, otherChargesCents: 0, fill: "pessimistic", excluded: [], jpHourValueCents: DEFAULT_JP_HOUR_VALUE_CENTS, seasonKey: null };

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
    excluded: Array.isArray(r.excluded) ? [...new Set(r.excluded.map(String))].slice(0, 200) : [],
    jpHourValueCents: r.jpHourValueCents === undefined || r.jpHourValueCents === null ? DEFAULT_JP_HOUR_VALUE_CENTS : c(r.jpHourValueCents),
    seasonKey: typeof r.seasonKey === "string" && r.seasonKey.trim() ? r.seasonKey.trim().slice(0, 80) : null
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
  /** Coût d'opportunité : tes heures × ce que vaut ton heure ailleurs. */
  opportunityCents: number;
  /** Bénéfice des programmes − coût d'opportunité : positif = ces programmes valent mieux que ton heure ailleurs. */
  overOpportunityCents: number;
  /** Le budget de la saison par poste, au remplissage choisi. */
  budget: BudgetLine[];
}

/** Postes du budget, rangés dans les catégories de dépenses de Revenus (revenue_expenses.category). */
export const BUDGET_POSTS = [
  { key: "field", label: "Terrain et gymnases", category: "Location / Terrain" },
  { key: "coaches", label: "Éducateurs", category: "Salaires / Contractants" },
  { key: "jp", label: "Ton salaire", category: "Salaires / Contractants" },
  { key: "equipment", label: "Matériel", category: "Équipement" },
  { key: "kit", label: "Uniformes et kits", category: "Équipement" },
  { key: "marketing", label: "Marketing", category: "Marketing / Pub" },
  { key: "insurance", label: "Assurance", category: "Assurance" },
  { key: "stripe", label: "Frais Stripe", category: "Frais Stripe / Bancaires" },
  { key: "other", label: "Autres coûts des programmes", category: "Autre" },
  { key: "charges", label: "Autres charges de la saison", category: "Autre" }
] as const;
export type BudgetPost = (typeof BUDGET_POSTS)[number]["key"];

export interface BudgetLine {
  key: BudgetPost;
  label: string;
  category: string;
  cents: number;
}

/** Dépensé à ce jour et reste, par catégorie de dépenses, à partir des dépenses entrées dans Revenus. */
export function budgetVsSpent(budget: BudgetLine[], spentByCategory: Record<string, number>) {
  const cats = new Map<string, { category: string; labels: string[]; budgetCents: number }>();
  for (const l of budget) {
    if (!l.cents) continue;
    const c = cats.get(l.category) ?? { category: l.category, labels: [], budgetCents: 0 };
    c.labels.push(l.label);
    c.budgetCents += l.cents;
    cats.set(l.category, c);
  }
  for (const [category, cents] of Object.entries(spentByCategory)) if (cents && !cats.has(category)) cats.set(category, { category, labels: [], budgetCents: 0 });
  return [...cats.values()].map((c) => {
    const spentCents = spentByCategory[c.category] ?? 0;
    return { ...c, spentCents, leftCents: c.budgetCents - spentCents, used: c.budgetCents > 0 ? spentCents / c.budgetCents : null };
  });
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
  const opportunityCents = Math.round(jpHours * settings.jpHourValueCents);

  // Budget par poste : coûts fixes de chaque programme compté + coûts par inscrite au remplissage choisi.
  const post: Record<BudgetPost, number> = { field: 0, coaches: 0, jp: settings.jpSalaryCents, equipment: 0, kit: 0, marketing: 0, insurance: 0, stripe: 0, other: 0, charges: settings.otherChargesCents };
  for (const s of list) {
    const line = lines.find((l) => l.id === s.id);
    if (!line?.included) continue;
    const fixed = (k: string) => s.results.fixedLines.find((f) => f.key === k)?.cents ?? 0;
    post.field += fixed("field");
    post.coaches += fixed("coaches");
    post.equipment += fixed("equipment");
    post.marketing += fixed("marketing");
    post.insurance += fixed("insurance");
    post.other += fixed("other") + line.count * s.inputs.otherVariableCents;
    post.kit += line.count * s.inputs.kitCents;
    // Frais Stripe : le reste des coûts du programme (évite l'écart d'arrondi par inscrite).
    post.stripe += line.costCents - s.results.fixedCents - line.count * (s.inputs.kitCents + s.inputs.otherVariableCents);
  }
  const budget: BudgetLine[] = BUDGET_POSTS.map((p) => ({ key: p.key, label: p.label, category: p.category, cents: Math.round(post[p.key]) }));
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
    margin: revenueCents > 0 ? programProfitCents / revenueCents : null,
    opportunityCents,
    overOpportunityCents: programProfitCents - opportunityCents,
    budget
  };
}

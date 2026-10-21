/** Règles pures des plages de match (sans accès base de données) — partagées entre
 *  le serveur (validation) et la page de réservation (affichage). */

export type SlotGender = "tous" | "filles" | "garcons";
export type TeamGender = "filles" | "garcons" | "mixte";

/** Une catégorie d'équipe admise sur une plage (genre + années de naissance). */
export interface CategoryRule {
  /** « tous » = n'importe quel genre. */
  gender: SlotGender;
  birthYearMin: number | null;
  birthYearMax: number | null;
  /** Groupe exact : l'équipe doit couvrir exactement ces années (ex. un groupe 2014-2015). */
  exact?: boolean;
  /** Calibres exigés (ex. ["P1"]) ; vide = tous les calibres. */
  levels?: string[];
}

export interface SlotRules {
  allowed_gender: SlotGender;
  birth_year_min: number | null;
  birth_year_max: number | null;
  restriction_note: string | null;
  /** Si présent, remplace allowed_gender / birth_year_* : l'équipe doit correspondre à AU MOINS une catégorie. */
  allowed_categories?: CategoryRule[] | null;
  /** Précision positive affichée aux équipes (p. ex. « Équipe 2014 recherchée »). */
  preferred_note?: string | null;
  /** Les équipes non admissibles d'office peuvent faire une demande (approuvée ou non par l'académie). */
  allow_requests?: boolean;
}

export interface TeamCategory {
  gender: TeamGender;
  /** Année de naissance (la plus ancienne si l'équipe est un groupe de deux années). */
  birthYear: number;
  /** Groupe de plusieurs années (ex. 2014-2015) : la plus récente ; absent = une seule année. */
  birthYearTo?: number | null;
  /** Calibre de l'équipe (ex. « P1 »). */
  level?: string | null;
}

/** Calibres proposés aux équipes à la création du compte. */
export const TEAM_LEVELS = ["Récréatif", "Intermédiaire", "Compétitif", "AA", "AAA", "P1", "Élite"] as const;

/** « 2014 » ou « 2014-2015 ». */
export function teamYearsValue(team: Pick<TeamCategory, "birthYear" | "birthYearTo">): string {
  const to = team.birthYearTo ?? team.birthYear;
  return to !== team.birthYear ? `${team.birthYear}-${to}` : String(team.birthYear);
}

/** « nés en 2014 » ou « groupe 2014-2015 ». */
export function teamYearsLabel(team: Pick<TeamCategory, "birthYear" | "birthYearTo">): string {
  const to = team.birthYearTo ?? team.birthYear;
  return to !== team.birthYear ? `groupe ${team.birthYear}-${to}` : `nés en ${team.birthYear}`;
}

/** « 2014 » → {2014, 2014} ; « 2014-2015 » → {2014, 2015}. */
export function parseTeamYears(value: string): { from: number; to: number } | null {
  const m = value.trim().match(/^(\d{4})(?:\s*-\s*(\d{4}))?$/);
  if (!m) return null;
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : from;
  if (to < from || to - from > 2) return null;
  return { from, to };
}

const GENDER_LABEL: Record<SlotGender, string> = { tous: "", filles: "filles", garcons: "garçons" };

/** Catégories admises de la plage, en tenant compte des anciennes colonnes simples. */
export function effectiveCategories(rules: SlotRules): CategoryRule[] | null {
  if (rules.allowed_categories && rules.allowed_categories.length > 0) return rules.allowed_categories;
  if (rules.allowed_gender !== "tous" || rules.birth_year_min != null || rules.birth_year_max != null) {
    return [{ gender: rules.allowed_gender, birthYearMin: rules.birth_year_min, birthYearMax: rules.birth_year_max }];
  }
  return null;
}

function yearsLabel(min: number | null, max: number | null, feminine: boolean): string | null {
  const nes = feminine ? "nées" : "nés";
  if (min != null && max != null) return min === max ? `${nes} en ${min}` : `${nes} entre ${min} et ${max}`;
  if (max != null) return `${nes} en ${max} ou plus tôt`;
  if (min != null) return `${nes} en ${min} ou plus tard`;
  return null;
}

/** Libellé d'une catégorie : « Garçons nés en 2014 », « Filles nées entre 2015 et 2016 », « Toutes les équipes… ». */
export function categoryLabel(c: CategoryRule): string {
  const feminine = c.gender === "filles";
  if (c.exact && c.birthYearMin != null && c.birthYearMax != null && c.birthYearMin !== c.birthYearMax) {
    const who = c.gender === "tous" ? "Groupes" : c.gender === "filles" ? "Groupes filles" : "Groupes garçons";
    return `${who} ${c.birthYearMin}-${c.birthYearMax}${c.levels?.length ? ` (calibre ${c.levels.join(" ou ")})` : ""}`;
  }
  const years = yearsLabel(c.birthYearMin, c.birthYearMax, feminine);
  const who = c.gender === "tous" ? "Tous genres" : c.gender === "filles" ? "Filles" : "Garçons";
  const base = years ? `${who} ${years}` : who;
  return c.levels?.length ? `${base} (calibre ${c.levels.join(" ou ")})` : base;
}

/** Texte clair des restrictions d'une plage, ou null si aucune (ouverte à tous). */
export function restrictionLabel(rules: SlotRules): string | null {
  const cats = effectiveCategories(rules);
  const parts: string[] = [];
  if (cats) {
    const legacySingle = !(rules.allowed_categories && rules.allowed_categories.length > 0);
    if (legacySingle) {
      const c = cats[0];
      if (c.gender !== "tous") parts.push(`Équipes ${GENDER_LABEL[c.gender]} seulement`);
      const y = yearsLabel(c.birthYearMin, c.birthYearMax, false);
      if (y) parts.push(y);
    } else {
      parts.push(cats.map(categoryLabel).join(" · ") );
    }
  }
  if (rules.restriction_note?.trim()) parts.push(rules.restriction_note.trim());
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/** Une équipe peut-elle réserver cette plage ? `reason` explique le refus. */
export function checkEligibility(rules: SlotRules, team: TeamCategory | null): { ok: true } | { ok: false; reason: string } {
  const cats = effectiveCategories(rules);
  if (!cats) return { ok: true };
  if (!team) return { ok: false, reason: "Indiquez d'abord la catégorie de votre équipe." };
  const from = team.birthYear;
  const to = team.birthYearTo ?? team.birthYear;
  const matches = cats.some((c) => {
    const genderOk = (c.gender === "tous" || c.gender === team.gender) && (!c.levels?.length || (team.level != null && c.levels.includes(team.level)));
    if (c.exact) return genderOk && from === c.birthYearMin && to === c.birthYearMax;
    // L'équipe (une année ou un groupe d'années) doit être entièrement dans la fourchette admise.
    const minOk = c.birthYearMin == null || from >= c.birthYearMin;
    const maxOk = c.birthYearMax == null || to <= c.birthYearMax;
    return genderOk && minOk && maxOk;
  });
  if (matches) return { ok: true };
  if (cats.length === 1 && !cats[0].exact) {
    const c = cats[0];
    if (c.gender !== "tous" && team.gender !== c.gender) return { ok: false, reason: `Plage réservée aux équipes ${GENDER_LABEL[c.gender]}.` };
    if (c.birthYearMin != null && from < c.birthYearMin) return { ok: false, reason: `Plage réservée aux joueurs nés en ${c.birthYearMin} ou plus tard.` };
    if (c.birthYearMax != null && to > c.birthYearMax) return { ok: false, reason: `Plage réservée aux joueurs nés en ${c.birthYearMax} ou plus tôt.` };
  }
  return { ok: false, reason: `Plage réservée à : ${cats.map(categoryLabel).join(" ou ").toLowerCase()}.` };
}

interface GroupedSlot {
  id: string;
  double_group: string | null;
}

/** Une double cédule se réserve en bloc : choisir une plage choisit aussi les autres du groupe. */
export function expandDoubles<T extends GroupedSlot>(ids: string[], all: T[]): string[] {
  const byId = new Map(all.map((s) => [s.id, s]));
  const out = new Set<string>();
  for (const id of ids) {
    const s = byId.get(id);
    if (!s) {
      out.add(id);
      continue;
    }
    out.add(s.id);
    if (s.double_group) for (const o of all) if (o.double_group === s.double_group) out.add(o.id);
  }
  return Array.from(out);
}

/** Deux plages qui se suivent au même endroit le même jour forment une double cédule. */
export function areConsecutive(a: { slot_date: string; location: string; end_time: string }, b: { slot_date: string; location: string; start_time: string }): boolean {
  return a.slot_date === b.slot_date && a.location === b.location && a.end_time === b.start_time;
}

/** Totaux d'un lot de plages : acompte à payer en ligne + solde dû le jour du match. */
export function totalsFor(slots: { price_cents: number; balance_due_cents: number }[]): { depositCents: number; balanceCents: number; totalCents: number } {
  const depositCents = slots.reduce((n, s) => n + s.price_cents, 0);
  const balanceCents = slots.reduce((n, s) => n + s.balance_due_cents, 0);
  return { depositCents, balanceCents, totalCents: depositCents + balanceCents };
}

/** Équipes de chez nous : règles d'admissibilité préparées pour chaque groupe adversaire.
 *  Toute autre équipe peut faire une demande (sauf si allowRequests = false). */
export const NV_OPPONENT_PRESETS: { key: string; opponent: string; categories: CategoryRule[]; allowRequests: boolean; note: string }[] = [
  {
    key: "2015-av",
    opponent: "New Valkyria — Équipe 2015 avancé (filles)",
    categories: [
      { gender: "filles", birthYearMin: 2014, birthYearMax: 2014 },
      { gender: "filles", birthYearMin: 2014, birthYearMax: 2015, exact: true },
      { gender: "garcons", birthYearMin: 2014, birthYearMax: 2015 }
    ],
    allowRequests: true,
    note: "Filles 2015 : sur demande seulement."
  },
  {
    key: "2016-2017-av",
    opponent: "New Valkyria — Équipe 2016-2017 avancé (filles)",
    categories: [
      { gender: "tous", birthYearMin: 2015, birthYearMax: 2015 },
      { gender: "tous", birthYearMin: 2016, birthYearMax: 2016, levels: ["P1"] }
    ],
    allowRequests: true,
    note: "Équipes 2016 : calibre P1 obligatoire."
  },
  {
    key: "2015-int",
    opponent: "New Valkyria — Équipe 2015 intermédiaire (filles)",
    categories: [
      { gender: "tous", birthYearMin: 2014, birthYearMax: 2015 },
      { gender: "garcons", birthYearMin: 2016, birthYearMax: 2016 }
    ],
    allowRequests: true,
    note: ""
  },
  {
    key: "2016-2017-int",
    opponent: "New Valkyria — Équipe 2016-2017 intermédiaire (filles)",
    categories: [{ gender: "filles", birthYearMin: 2016, birthYearMax: 2016 }],
    allowRequests: false,
    note: "Seulement des équipes filles 2016."
  }
];

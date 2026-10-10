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
}

export interface TeamCategory {
  gender: TeamGender;
  birthYear: number;
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
  const years = yearsLabel(c.birthYearMin, c.birthYearMax, feminine);
  const who = c.gender === "tous" ? "Tous genres" : c.gender === "filles" ? "Filles" : "Garçons";
  return years ? `${who} ${years}` : who;
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
  const matches = cats.some((c) => {
    const genderOk = c.gender === "tous" || c.gender === team.gender;
    const minOk = c.birthYearMin == null || team.birthYear >= c.birthYearMin;
    const maxOk = c.birthYearMax == null || team.birthYear <= c.birthYearMax;
    return genderOk && minOk && maxOk;
  });
  if (matches) return { ok: true };
  if (cats.length === 1) {
    const c = cats[0];
    if (c.gender !== "tous" && team.gender !== c.gender) return { ok: false, reason: `Plage réservée aux équipes ${GENDER_LABEL[c.gender]}.` };
    if (c.birthYearMin != null && team.birthYear < c.birthYearMin) return { ok: false, reason: `Plage réservée aux joueurs nés en ${c.birthYearMin} ou plus tard.` };
    if (c.birthYearMax != null && team.birthYear > c.birthYearMax) return { ok: false, reason: `Plage réservée aux joueurs nés en ${c.birthYearMax} ou plus tôt.` };
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

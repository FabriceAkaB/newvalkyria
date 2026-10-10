/** Règles pures des plages de match (sans accès base de données) — partagées entre
 *  le serveur (validation) et la page de réservation (affichage). */

export type SlotGender = "tous" | "filles" | "garcons";
export type TeamGender = "filles" | "garcons" | "mixte";

export interface SlotRules {
  allowed_gender: SlotGender;
  birth_year_min: number | null;
  birth_year_max: number | null;
  restriction_note: string | null;
}

export interface TeamCategory {
  gender: TeamGender;
  birthYear: number;
}

const GENDER_LABEL: Record<SlotGender, string> = { tous: "", filles: "filles", garcons: "garçons" };

/** Texte clair des restrictions d'une plage, ou null si aucune (ouverte à tous). */
export function restrictionLabel(rules: SlotRules): string | null {
  const parts: string[] = [];
  if (rules.allowed_gender !== "tous") parts.push(`Équipes ${GENDER_LABEL[rules.allowed_gender]} seulement`);
  const { birth_year_min: min, birth_year_max: max } = rules;
  if (min != null && max != null) parts.push(min === max ? `nés en ${min}` : `nés entre ${min} et ${max}`);
  else if (max != null) parts.push(`nés en ${max} ou plus tôt`);
  else if (min != null) parts.push(`nés en ${min} ou plus tard`);
  if (rules.restriction_note?.trim()) parts.push(rules.restriction_note.trim());
  if (parts.length === 0) return null;
  const [first, ...rest] = parts;
  return [first, ...rest].join(" · ");
}

/** Une équipe peut-elle réserver cette plage ? `reason` explique le refus. */
export function checkEligibility(rules: SlotRules, team: TeamCategory | null): { ok: true } | { ok: false; reason: string } {
  const restricted = rules.allowed_gender !== "tous" || rules.birth_year_min != null || rules.birth_year_max != null;
  if (!restricted) return { ok: true };
  if (!team) return { ok: false, reason: "Indiquez d'abord la catégorie de votre équipe." };
  if (rules.allowed_gender !== "tous" && team.gender !== rules.allowed_gender) {
    return { ok: false, reason: `Plage réservée aux équipes ${GENDER_LABEL[rules.allowed_gender]}.` };
  }
  if (rules.birth_year_min != null && team.birthYear < rules.birth_year_min) {
    return { ok: false, reason: `Plage réservée aux joueurs nés en ${rules.birth_year_min} ou plus tard.` };
  }
  if (rules.birth_year_max != null && team.birthYear > rules.birth_year_max) {
    return { ok: false, reason: `Plage réservée aux joueurs nés en ${rules.birth_year_max} ou plus tôt.` };
  }
  return { ok: true };
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

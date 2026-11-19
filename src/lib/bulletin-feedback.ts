/** Sondage court après chaque bulletin (Mandalart P4.8.11, JP 19 nov. 2026) : sous le bulletin remis, le parent dit
 *  s'il lui est utile (oui, en partie, non) et ce qui manque. Une réponse par parent, par fille et par bulletin,
 *  modifiable. Règles pures, testées (bulletin-feedback.test.ts) ; base : bulletin-feedback-repo.ts. */

import type { BulletinPeriod } from "@/lib/bulletin-report";

export const USEFUL_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "en_partie", label: "En partie" },
  { value: "non", label: "Non" }
] as const;
export type Useful = (typeof USEFUL_OPTIONS)[number]["value"];

export const MISSING_MAX = 1000;

export const usefulLabel = (u: Useful) => USEFUL_OPTIONS.find((o) => o.value === u)?.label ?? u;
export const periodLabel = (p: BulletinPeriod) => (p === "mi-saison" ? "Mi-saison" : "Fin de saison");

export interface FeedbackInput {
  registrationId: string;
  period: BulletinPeriod;
  useful: Useful;
  missing: string | null;
}

/** Valide ce que le parent envoie. Renvoie la réponse propre, ou le problème à montrer. */
export function normalizeFeedback(raw: unknown): { ok: true; value: FeedbackInput } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  if (typeof b.registrationId !== "string" || !/^[0-9a-f-]{36}$/i.test(b.registrationId)) return { ok: false, error: "Bulletin introuvable." };
  if (b.period !== "mi-saison" && b.period !== "fin-saison") return { ok: false, error: "Bulletin introuvable." };
  if (!USEFUL_OPTIONS.some((o) => o.value === b.useful)) return { ok: false, error: "Choisissez Oui, En partie ou Non." };
  const missing = typeof b.missing === "string" ? b.missing.trim().replace(/[ \t]+/g, " ") : "";
  if (missing.length > MISSING_MAX) return { ok: false, error: `${MISSING_MAX} caractères au plus.` };
  return { ok: true, value: { registrationId: b.registrationId, period: b.period, useful: b.useful as Useful, missing: missing || null } };
}

export interface FeedbackRow {
  period: BulletinPeriod;
  useful: Useful;
  missing: string | null;
}

/** Résumé pour JP : combien de réponses, part de « oui », et combien disent ce qui manque. */
export function summarizeFeedback(rows: FeedbackRow[]) {
  const count = (u: Useful) => rows.filter((r) => r.useful === u).length;
  const total = rows.length;
  return {
    total,
    oui: count("oui"),
    enPartie: count("en_partie"),
    non: count("non"),
    usefulRate: total ? Math.round((count("oui") / total) * 100) : null,
    withComment: rows.filter((r) => r.missing).length
  };
}

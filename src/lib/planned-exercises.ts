/** « Exercices prévus : faits ? » (JP, 26 nov. 2026) : règles pures.
 *  Dans le rapport, chaque bloc du plan de la pratique reçoit Oui (fait) ou Non (pas fait). Une seule réponse par bloc,
 *  partagée par tous les éducateurs de la pratique, gardée dans `activity_session_blocks` :
 *  - Non  = `not_done` vrai (+ `not_done_by`, `not_done_at`) ;
 *  - Oui  = `not_done` faux avec `not_done_at` (qui et quand) ;
 *  - sans réponse = `not_done` faux et `not_done_at` vide.
 *  Les autres questions lisent et écrivent ce même état, sans contradiction possible :
 *  la ligne du ball mastery (Non = gestes retirés de l'évaluation, ball-mastery-skip.ts), « On ne l'a pas fait » de la
 *  note des exercices, et « Fait / Modifié / Sauté » du rapport journalier (Sauté = Non ; Fait ou Modifié = Oui).
 *  Depuis le 26 nov. 2026, répondre pour chaque bloc fait partie du rapport complet des coachs (paie : heure de rapport).
 *  Les pratiques d'avant ne sont pas touchées. */

import type { ExerciseOutcome } from "@/lib/practice-journal";

/** Premier jour où « Exercices prévus répondus » compte dans le rapport complet. */
export const PLANNED_EXERCISES_RULE_START = "2026-11-26";

export type BlockAnswer = "oui" | "non" | null;

export interface PlannedBlockState {
  not_done?: boolean | null;
  not_done_at?: string | null;
}

/** La réponse d'un bloc : Non s'il est marqué pas fait, Oui si quelqu'un a répondu qu'il était fait, sinon rien. */
export function blockAnswer(block: PlannedBlockState): BlockAnswer {
  if (block.not_done) return "non";
  return block.not_done_at ? "oui" : null;
}

export interface PlannedSummary {
  total: number;
  answered: number;
  done: number;
  notDone: number;
  /** Chaque bloc a sa réponse (vrai aussi s'il n'y a aucun bloc). */
  complete: boolean;
}

export function plannedSummary(blocks: PlannedBlockState[]): PlannedSummary {
  const answers = blocks.map(blockAnswer);
  const done = answers.filter((a) => a === "oui").length;
  const notDone = answers.filter((a) => a === "non").length;
  return { total: blocks.length, answered: done + notDone, done, notDone, complete: done + notDone === blocks.length };
}

/** La question fait-elle partie du rapport complet pour cette pratique ? (à partir du 26 nov. 2026, s'il y a un plan) */
export function plannedRequired(activityDate: string | null | undefined, blockCount: number): boolean {
  return blockCount > 0 && Boolean(activityDate) && String(activityDate).slice(0, 10) >= PLANNED_EXERCISES_RULE_START;
}

/** Ce que la base reçoit quand on répond Oui (fait) ou Non (pas fait) pour un bloc. */
export function answerPatch(done: boolean, byCoachId: string | null, note: string | null = null, now: Date = new Date()) {
  return { not_done: !done, not_done_note: done ? null : note?.slice(0, 500) || null, not_done_by: byCoachId, not_done_at: now.toISOString() };
}

/** Le rapport journalier montre l'état partagé : Non = « Sauté » ; Oui = « Fait », ou « Modifié » si ce coach l'a noté.
 *  Sans réponse partagée, l'ancienne valeur du journal (pratiques d'avant) reste affichée. */
export function journalOutcome(answer: BlockAnswer, own: ExerciseOutcome | undefined): ExerciseOutcome | undefined {
  if (answer === "non") return "saute";
  if (answer === "oui") return own === "modifie" ? "modifie" : "fait";
  return own;
}

/** « Fait » ou « Modifié » = le bloc a été fait ; « Sauté » = pas fait. */
export const outcomeDone = (o: ExerciseOutcome) => o !== "saute";

/** Libellé d'un bloc du plan : son titre propre, sinon celui de l'exercice de la banque, sinon son type. */
export function blockTitle(block: { custom_title?: string | null; exercise_id?: string | null; block_type?: string | null }, exerciseTitle: (id: string) => string | null | undefined): string {
  return block.custom_title?.trim() || (block.exercise_id ? exerciseTitle(block.exercise_id) : null) || block.block_type || "Bloc";
}

/** Ce qui manque, en mots simples (liste du rapport, Ma paie, admin). */
export function plannedMissingLabel(missing: number): string | null {
  if (missing <= 0) return null;
  return `exercices prévus : réponds Oui ou Non pour ${missing} exercice${missing > 1 ? "s" : ""}`;
}

/** Les composants qui montrent cet état (carte, rapport journalier, note des exercices) se resynchronisent entre eux. */
export const PLANNED_EVENT = "nv-exercices-prevus";

export function announcePlannedChange(activityId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLANNED_EVENT, { detail: { activityId } }));
}

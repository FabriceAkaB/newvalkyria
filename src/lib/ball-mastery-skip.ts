/** « Le ball mastery n'a pas été fait » (JP, 25 nov. 2026) : règles pures.
 *  Ce n'est pas tout le temps qu'on fait le ball mastery (pas le temps, etc.). Un éducateur de la pratique (ou JP depuis
 *  l'admin) le marque une fois pour toute la pratique : les blocs ball mastery du plan passent à « pas fait »
 *  (`activity_session_blocks.not_done`, le même drapeau que « On ne l'a pas fait » de la note des exercices).
 *  Effets : la section des gestes du ball mastery disparaît de l'évaluation de chaque fille, le rapport est complet
 *  sans elle, et les gestes déjà notés ce jour-là restent en base mais ne comptent plus nulle part (rapports des
 *  joueuses, moyennes, résumé de saison, bulletin, passeport, briefing). La note « Ball mastery » de 1 à 5 reste :
 *  elle juge la maîtrise du ballon pendant toute la pratique. Réversible (« Finalement on l'a fait »). */

export interface BallMasteryBlock {
  block_type: string | null;
  exercise_id: string | null;
  not_done?: boolean | null;
}

/** Bloc de ball mastery : type de bloc « Ball mastery » ou exercice de la banque de type « ball-mastery ». */
export function isBallMasteryBlock(block: BallMasteryBlock, exerciseType: (exerciseId: string) => string | null | undefined): boolean {
  if (block.block_type === "Ball mastery") return true;
  return Boolean(block.exercise_id) && exerciseType(block.exercise_id!) === "ball-mastery";
}

/** Le plan de la pratique a-t-il du ball mastery, et a-t-il été marqué « pas fait » (tous ses blocs) ? */
export function ballMasteryState(blocks: BallMasteryBlock[], exerciseType: (exerciseId: string) => string | null | undefined): { planned: boolean; skipped: boolean } {
  const bm = blocks.filter((b) => isBallMasteryBlock(b, exerciseType));
  return { planned: bm.length > 0, skipped: bm.length > 0 && bm.every((b) => Boolean(b.not_done)) };
}

/** Une évaluation lue pour les rapports et les moyennes : si le ball mastery n'a pas été fait ce jour-là, ses gestes
 *  (notes sur 10 et gestes « à retravailler » tirés de ces notes) sont retirés. Les gestes difficiles ajoutés à la main
 *  restent. Rien n'est effacé en base. */
export function withoutSkippedGestures<T extends { gesture_scores?: Record<string, number> | null; gestures?: string[] | null }>(evaluation: T, skipped: boolean): T {
  if (!skipped) return evaluation;
  const scored = new Set(Object.keys(evaluation.gesture_scores ?? {}));
  return {
    ...evaluation,
    gesture_scores: {},
    gestures: Array.isArray(evaluation.gestures) ? evaluation.gestures.filter((g) => !scored.has(g)) : evaluation.gestures
  };
}

/** Laboratoire des éducateurs (JP, 17 nov. 2026) : on teste un concept à une pratique, on note si la séance s'est
 *  améliorée (1 à 5) ; le statut se calcule, et JP fait entrer dans la méthode ce qui a beaucoup de succès.
 *  Règles pures, testées (coach-lab-core.test.ts). */

export type LabStatus = "a_tester" | "en_test" | "concluant" | "a_revoir" | "abandonne" | "dans_methode";

export const LAB_STATUS_LABEL: Record<LabStatus, string> = {
  a_tester: "À tester",
  en_test: "En test",
  concluant: "Concluant",
  a_revoir: "À revoir",
  abandonne: "Abandonné",
  dans_methode: "Dans la méthode"
};

export const LAB_STATUS_TONE: Record<LabStatus, "good" | "warn" | "bad" | "info" | undefined> = {
  a_tester: undefined,
  en_test: "info",
  concluant: "good",
  a_revoir: "warn",
  abandonne: undefined,
  dans_methode: "good"
};

/** « Est-ce que ça a amélioré la séance ? » */
export const LAB_RATING: Record<number, string> = {
  1: "Pire qu'avant",
  2: "Pas de différence",
  3: "Un peu mieux",
  4: "Nettement mieux",
  5: "Ça a transformé la séance"
};

/** Il faut au moins 2 essais (idéalement par 2 éducateurs différents) pour conclure. */
export const MIN_TRIALS = 2;

/** Statut calculé d'après les essais ; une décision de JP (abandonné, dans la méthode) n'est jamais écrasée. */
export function labStatus(current: LabStatus, ratings: number[]): LabStatus {
  if (current === "abandonne" || current === "dans_methode") return current;
  if (!ratings.length) return "a_tester";
  if (ratings.length < MIN_TRIALS) return "en_test";
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  if (avg >= 4) return "concluant";
  if (avg < 3) return "a_revoir";
  return "en_test";
}

export const average = (ratings: number[]) => (ratings.length ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10 : null);

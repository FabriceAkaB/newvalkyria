/** Rapport journalier des pratiques (JP, 20 nov. 2026) : la mémoire de ce qui s'est vraiment passé à chaque pratique,
 *  rempli au fil de la journée (chaque champ s'enregistre seul), facile à consulter par date, groupe et coach.
 *  Distinct de l'évaluation professionnelle du coach : on décrit la pratique, pas la personne. Règles pures.
 *  Les réussites (2 points) et les améliorations (2 points) restent dans le retour sur la pratique (went_well,
 *  to_improve), qui compte pour l'heure de rapport des coachs. */

export type JournalKind = "scale" | "text";

export interface JournalField {
  key: string;
  label: string;
  kind: JournalKind;
  /** Aide courte sous le champ. */
  hint: string;
}

/** Les échelles (1 à 5) se remplissent d'un toucher ; une note facultative les précise (clé `${key}_note`). */
export const JOURNAL_FIELDS: JournalField[] = [
  { key: "deroulement", label: "Déroulement général", kind: "text", hint: "En 2 ou 3 phrases : comment la pratique s'est passée, du début à la fin." },
  { key: "programme", label: "Respect du programme prévu", kind: "scale", hint: "1 = tout a changé, 5 = le plan suivi tel quel." },
  { key: "temps", label: "Gestion du temps", kind: "scale", hint: "1 = beaucoup de retard ou un bloc sauté, 5 = chaque bloc à l'heure (minuteur)." },
  { key: "transitions", label: "Qualité des transitions", kind: "scale", hint: "1 = longues attentes entre les blocs, 5 = enchaînement rapide, terrain monté d'avance." },
  { key: "repetitions", label: "Qualité des répétitions", kind: "scale", hint: "1 = beaucoup d'attente en file, 5 = chaque fille touche le ballon sans arrêt." },
  { key: "consignes", label: "Compréhension des consignes", kind: "scale", hint: "1 = il a fallu tout réexpliquer, 5 = compris du premier coup." },
  { key: "comportements", label: "Comportements observés", kind: "text", hint: "Attitude du groupe, une fille à surveiller, un conflit, une belle entraide." },
  { key: "difficultes", label: "Difficultés rencontrées", kind: "text", hint: "Ce qui a bloqué : un exercice trop dur, le terrain, le nombre de filles…" },
  { key: "sondage_presence", label: "Sondages et présences", kind: "text", hint: "Sondage de fin fait ? Présences à jour dans MonClubSportif ? Une fille ajoutée ou absente ?" },
  { key: "materiel", label: "Matériel et caméras", kind: "text", hint: "Matériel manquant ou brisé, caméra Veo ou 360° installée, batterie, vidéo lancée." }
];

export type ExerciseOutcome = "fait" | "modifie" | "saute";
export const EXERCISE_OUTCOMES: { value: ExerciseOutcome; label: string }[] = [
  { value: "fait", label: "Fait" },
  { value: "modifie", label: "Modifié" },
  { value: "saute", label: "Sauté" }
];

export interface Journal {
  [key: string]: string | number | Record<string, ExerciseOutcome> | undefined;
  /** Exercices réalisés : l'issue de chaque bloc du plan (id du bloc → fait / modifié / sauté). */
  exercices?: Record<string, ExerciseOutcome>;
}

const FIELD_KEYS = new Set(JOURNAL_FIELDS.map((f) => f.key));
const SCALE_KEYS = new Set(JOURNAL_FIELDS.filter((f) => f.kind === "scale").map((f) => f.key));

/** Nettoie une mise à jour partielle (un seul champ à la fois, par l'enregistrement automatique). */
export function parseJournalPatch(input: unknown): Journal | null {
  if (!input || typeof input !== "object") return null;
  const out: Journal = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SCALE_KEYS.has(k)) {
      const n = Number(v);
      if (v === null || v === "") out[k] = undefined;
      else if (Number.isInteger(n) && n >= 1 && n <= 5) out[k] = n;
    } else if (FIELD_KEYS.has(k) || (k.endsWith("_note") && SCALE_KEYS.has(k.slice(0, -5)))) {
      out[k] = typeof v === "string" ? v.slice(0, 2000) : undefined;
    } else if (k === "exercices" && v && typeof v === "object") {
      const ex: Record<string, ExerciseOutcome> = {};
      for (const [id, o] of Object.entries(v as Record<string, unknown>)) {
        if (/^[0-9a-f-]{36}$/i.test(id) && EXERCISE_OUTCOMES.some((x) => x.value === o)) ex[id] = o as ExerciseOutcome;
      }
      out.exercices = ex;
    }
  }
  return Object.keys(out).length ? out : null;
}

/** Fusionne la mise à jour dans le rapport déjà enregistré (un champ vidé est retiré). */
export function mergeJournal(current: Journal | null | undefined, patch: Journal): Journal {
  const next: Journal = { ...(current ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (k === "exercices") next.exercices = { ...(current?.exercices ?? {}), ...(v as Record<string, ExerciseOutcome>) };
    else if (v === undefined || (typeof v === "string" && !v.trim())) delete next[k];
    else next[k] = v;
  }
  return next;
}

/** Combien de parties du rapport sont remplies (exercices compris), pour la barre « x / y ». */
export function journalProgress(j: Journal | null | undefined, blockCount: number): { done: number; total: number } {
  const total = JOURNAL_FIELDS.length + (blockCount > 0 ? 1 : 0);
  const filled = JOURNAL_FIELDS.filter((f) => {
    const v = j?.[f.key];
    return f.kind === "scale" ? typeof v === "number" : typeof v === "string" && v.trim().length > 0;
  }).length;
  const exercisesDone = blockCount > 0 && Object.keys(j?.exercices ?? {}).length >= blockCount ? 1 : 0;
  return { done: filled + exercisesDone, total };
}

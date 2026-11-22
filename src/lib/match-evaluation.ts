/** Fiche d'évaluation d'un match (JP, 22 nov. 2026) : dans l'espace des éducateurs, « Évaluer le match » ouvre une
 *  fiche détaillée en 10 points par joueuse présente (photo, poste joué, critères techniques, tactiques, physiques et
 *  mentaux notés de 1 à 5, points forts, à travailler, commentaire). Comme la borne de sondage, la fiche se remplit
 *  même sans réseau : chaque fiche est gardée sur l'appareil et envoyée dès que le réseau revient.
 *  Règles pures, testées (match-evaluation.test.ts) ; base : match_player_evaluations (+ criteria, strengths, to_improve). */

export const POSITION_LABELS: Record<string, string> = {
  GB: "Gardienne",
  AD: "Arrière droite",
  DC: "Défenseure centrale",
  AG: "Arrière gauche",
  MDC: "Milieu défensive",
  MC: "Milieu centrale",
  MOC: "Milieu offensive",
  AiD: "Ailière droite",
  AiG: "Ailière gauche",
  AT: "Attaquante"
};

export type PositionGroup = "gardienne" | "defense" | "milieu" | "attaque";

export function positionGroup(code: string | null | undefined): PositionGroup | null {
  if (!code) return null;
  if (code === "GB") return "gardienne";
  if (["AD", "DC", "AG"].includes(code)) return "defense";
  if (["MDC", "MC", "MOC"].includes(code)) return "milieu";
  if (["AiD", "AiG", "AT"].includes(code)) return "attaque";
  return null;
}

export type CriterionFamily = "Technique" | "Tactique" | "Physique" | "Mental";

export interface MatchCriterion {
  key: string;
  family: CriterionFamily;
  label: string;
  help: string;
}

/** Le critère du poste change selon où la joueuse a joué. */
const POSTE_CRITERION: Record<PositionGroup | "aucun", { label: string; help: string }> = {
  gardienne: { label: "Rôle de gardienne", help: "Arrêts, sorties, placement dans la cage, relance à la main et au pied." },
  defense: { label: "Rôle de défenseure", help: "Duels défensifs, couverture, marquage, relance propre vers le milieu." },
  milieu: { label: "Rôle de milieu", help: "Se rend disponible, oriente le jeu, récupère, fait le lien entre défense et attaque." },
  attaque: { label: "Rôle d'attaquante", help: "Appels en profondeur, 1 contre 1, finition, premier pressing." },
  aucun: { label: "Rôle au poste joué", help: "Fait ce que son poste demande (choisis le poste plus haut pour voir le détail)." }
};

/** Les 10 points de la fiche, dans l'ordre où l'éducateur les remplit. */
export function matchCriteria(positionCode: string | null | undefined): MatchCriterion[] {
  const poste = POSTE_CRITERION[positionGroup(positionCode) ?? "aucun"];
  return [
    { key: "controle", family: "Technique", label: "Contrôle et première touche", help: "Le ballon reste près d'elle, orienté vers la suite du jeu." },
    { key: "passe", family: "Technique", label: "Passes", help: "Précision, bon pied, bon moment ; la passe aide la coéquipière." },
    { key: "dribble", family: "Technique", label: "Dribble et 1 contre 1", help: "Ose garder le ballon, protège, élimine son adversaire (ball mastery en match)." },
    { key: "decision", family: "Tactique", label: "Prise de décision", help: "Lève la tête, choisit vite entre passer, conduire ou tirer." },
    { key: "poste", family: "Tactique", label: poste.label, help: poste.help },
    { key: "vitesse", family: "Physique", label: "Vitesse et réaction", help: "Démarre vite, réagit à la perte du ballon, gagne les courses." },
    { key: "endurance", family: "Physique", label: "Endurance et intensité", help: "Garde le même niveau d'effort jusqu'à la fin." },
    { key: "duels", family: "Physique", label: "Engagement dans les duels", help: "Va au contact, ne recule pas, se relève vite." },
    { key: "communication", family: "Mental", label: "Communication", help: "Parle sur le terrain : appelle le ballon, avertit, encourage ses coéquipières." },
    { key: "attitude", family: "Mental", label: "Attitude et consignes", help: "Écoute les consignes, réagit bien après une erreur, esprit d'équipe." }
  ];
}

export const CRITERIA_KEYS = matchCriteria(null).map((c) => c.key);

/** Échelle de 1 à 5, la même pour les 10 points. */
export const SCALE: { value: number; label: string }[] = [
  { value: 1, label: "À travailler" },
  { value: 2, label: "En progrès" },
  { value: 3, label: "Correct" },
  { value: 4, label: "Bon" },
  { value: 5, label: "Excellent" }
];

export type Criteria = Record<string, number>;

/** Garde seulement les 10 critères connus, notés de 1 à 5 (entiers). */
export function cleanCriteria(input: unknown): Criteria {
  const out: Criteria = {};
  if (!input || typeof input !== "object") return out;
  for (const k of CRITERIA_KEYS) {
    const v = Number((input as Record<string, unknown>)[k]);
    if (Number.isInteger(v) && v >= 1 && v <= 5) out[k] = v;
  }
  return out;
}

/** Note sur 10 : moyenne des critères notés (1 à 5) ramenée sur 10, à une décimale ; null si rien n'est noté. */
export function scoreOn10(criteria: Criteria): number | null {
  const vals = CRITERIA_KEYS.map((k) => criteria[k]).filter((v): v is number => typeof v === "number");
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 2 * 10) / 10;
}

export const ratedCount = (criteria: Criteria) => CRITERIA_KEYS.filter((k) => typeof criteria[k] === "number").length;

/** Fiche complète : les 10 points notés et au moins un mot (points forts, à travailler ou commentaire). */
export function isSheetComplete(s: { criteria: Criteria; strengths?: string | null; toImprove?: string | null; comment?: string | null }): boolean {
  return ratedCount(s.criteria) === CRITERIA_KEYS.length && [s.strengths, s.toImprove, s.comment].some((t) => (t ?? "").trim().length > 0);
}

/** Moyenne par famille (Technique, Tactique, Physique, Mental), sur 5, pour le résumé. */
export function familyAverages(criteria: Criteria): { family: CriterionFamily; avg: number | null }[] {
  const fams: CriterionFamily[] = ["Technique", "Tactique", "Physique", "Mental"];
  const all = matchCriteria(null);
  return fams.map((family) => {
    const vals = all.filter((c) => c.family === family).map((c) => criteria[c.key]).filter((v): v is number => typeof v === "number");
    return { family, avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null };
  });
}

/* ── Hors réseau : une fiche par joueuse, gardée sur l'appareil jusqu'à l'envoi ── */

export interface QueuedSheet {
  registrationId: string;
  /** false : la joueuse n'était pas au match (pas d'évaluation). */
  present: boolean;
  positionCode: string | null;
  criteria: Criteria;
  strengths: string;
  toImprove: string;
  comment: string;
  /** Moment de l'enregistrement (ms) : la plus récente gagne. */
  at: number;
}

export const sheetQueueKey = (activityId: string) => `nv-match-eval-${activityId}`;

export function parseSheetQueue(raw: string | null): QueuedSheet[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v)
      ? v
          .filter((q) => q && typeof q.registrationId === "string" && typeof q.at === "number" && typeof q.present === "boolean")
          .map((q) => ({ ...q, criteria: cleanCriteria(q.criteria), strengths: String(q.strengths ?? ""), toImprove: String(q.toImprove ?? ""), comment: String(q.comment ?? ""), positionCode: q.positionCode ?? null }))
      : [];
  } catch {
    return [];
  }
}

/** Qui afficher en premier : présentes (confirmées, dans l'alignement ou déjà évaluées), puis à confirmer, puis absentes. */
export type PresenceState = "presente" | "a_confirmer" | "absente";

export function presenceOf(p: { convocation?: string | null; inLineup?: boolean; evaluated?: boolean; queuedPresent?: boolean | null }): PresenceState {
  if (p.queuedPresent === false) return "absente";
  if (p.queuedPresent === true || p.evaluated || p.inLineup || p.convocation === "confirmed") return "presente";
  if (p.convocation === "absent" || p.convocation === "declined") return "absente";
  return "a_confirmer";
}

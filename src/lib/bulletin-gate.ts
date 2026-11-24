/** Le bulletin s'ouvre après le sondage de satisfaction (Mandalart P4.8.18 et P3.8.19, JP 25 nov. 2026 ;
 *  docs/strategie/machine-acquisition-90-jours.md, sections 5 et 7). Le parent clique sur le bulletin de sa fille,
 *  répond d'abord à un sondage de 2 minutes, puis le bulletin s'ouvre. À 9 ou 10 sur 10, un bouton « Laisser cet avis
 *  sur Google » copie son texte et ouvre la fenêtre d'avis de la fiche : c'est le parent qui publie (règle de Google),
 *  et aucune récompense n'est jamais liée à un avis Google.
 *
 *  Les réponses vont dans Voix des familles : un vrai sondage (`surveys`, type « bulletin ») par saison et par bulletin,
 *  une invitation par parent (`survey_invites`), ses réponses dans `survey_responses` (note de recommandation, familles
 *  à rappeler sous 7, courriel d'avis Google programmé, comme tous les sondages).
 *
 *  LES QUESTIONS : `GATE_QUESTIONS` ci-dessous sert seulement à créer le sondage la première fois. Ensuite JP les modifie
 *  dans l'admin (Voix des familles → le sondage du bulletin → Modifier le sondage), tant qu'aucun parent n'a répondu.
 *  Règles pures, testées (bulletin-gate.test.ts) ; base : bulletin-gate-repo.ts. */

import type { BulletinPeriod } from "@/lib/bulletin-report";
import { REVIEW_MIN_SCORE } from "@/lib/google-review";
import type { SurveyQuestion } from "@/lib/surveys-repo";

/** Les repères des questions dont le site se sert (garder ces id si JP réécrit le texte). */
export const GATE_IDS = { recommend: "recommandation", loves: "aime", sentence: "phrase", sentenceOk: "phrase_accord" } as const;

export const GATE_PROJECTS = ["Camp de jour d'été", "Valkyria Été", "Tournois", "Valkyria Lab", "Voyage 2028"];

/** Les 8 questions proposées (section 7 du plan), à valider par JP avant le 8 décembre. */
export const GATE_QUESTIONS: SurveyQuestion[] = [
  { id: GATE_IDS.recommend, type: "note10", role: "recommandation", required: true, label: "Sur 10, recommanderiez-vous New Valkyria à une autre famille ?", help: "0 = pas du tout, 10 = sans hésiter" },
  { id: GATE_IDS.loves, type: "texte", label: "Qu'est-ce que votre fille aime le plus à l'académie ?" },
  { id: "progres", type: "texte", label: "Qu'est-ce qui l'a fait progresser le plus cette saison ?" },
  { id: "ameliorer", type: "texte", label: "Qu'est-ce qu'on devrait améliorer en premier ?" },
  { id: "retour", type: "choix", required: true, label: "Votre fille revient-elle à la prochaine saison ?", options: ["Oui", "Peut-être", "Non"] },
  { id: "retour_pourquoi", type: "texte", label: "Pourquoi ? (facultatif)" },
  { id: "projets", type: "choix_multiple", label: "Quels projets l'intéressent ?", options: GATE_PROJECTS },
  { id: "famille_amie", type: "texte", label: "Connaissez-vous une famille qui aimerait essayer ? Son prénom et comment la joindre (avec son accord).", help: "Nous l'appellerons pour lui offrir un essai." },
  { id: GATE_IDS.sentence, type: "texte", label: "En une phrase, que diriez-vous à un parent qui hésite ?" },
  { id: GATE_IDS.sentenceOk, type: "oui_non", label: "Pouvons-nous citer cette phrase (avec votre prénom seulement) ?" }
];

export const gateTitle = (period: BulletinPeriod, seasonLabel: string) =>
  `Avant le bulletin ${period === "mi-saison" ? "de mi-saison" : "de fin de saison"} (${seasonLabel})`;

export const GATE_INTRO =
  "Avant d'ouvrir le bulletin de votre fille, 2 minutes pour nous dire comment ça se passe. Chaque réponse est lue par l'équipe et sert à préparer la suite de la saison.";

/** La clé du sondage d'une saison et d'un bulletin (app_settings « sondage_bulletin »). */
export const gateKey = (seasonId: string, period: BulletinPeriod) => `${seasonId}:${period}`;

/** Le parent doit-il d'abord répondre ? Seulement pour un bulletin remis, tant que le sondage n'est pas fermé par JP
 *  et que ce parent n'a pas répondu. Un sondage fermé ou introuvable n'empêche jamais de voir le bulletin. */
export function needsGate(input: { released: boolean; surveyStatus: string | null; respondedAt: string | null }): boolean {
  return input.released && !!input.surveyStatus && input.surveyStatus !== "ferme" && !input.respondedAt;
}

export const isGoogleReviewUrl = (url: string | null | undefined): url is string => !!url && /^https:\/\/\S+$/.test(url.trim());

/** Le bouton « Laisser cet avis sur Google » : à 9 ou 10 sur 10, et seulement quand le lien de la fiche est enregistré. */
export function showGoogleButton(score: number | null | undefined, url: string | null | undefined): boolean {
  return typeof score === "number" && score >= REVIEW_MIN_SCORE && isGoogleReviewUrl(url);
}

/** Le texte copié pour Google : la phrase pour un parent qui hésite, sinon ce que sa fille aime le plus. */
export function reviewDraft(answers: Record<string, unknown> | null | undefined): string {
  const pick = (id: string) => (typeof answers?.[id] === "string" ? String(answers[id]).trim().replace(/\s+/g, " ") : "");
  return (pick(GATE_IDS.sentence) || pick(GATE_IDS.loves)).slice(0, 3000);
}

/** Comptes qui voient les bulletins avant leur date de remise (tests, démonstration) : app_settings
 *  « bulletin_apercu_courriels », une liste de courriels. Les familles, elles, attendent la date de remise. */
export function hasEarlyAccess(email: string | null | undefined, list: unknown): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e || !Array.isArray(list)) return false;
  return list.some((x) => typeof x === "string" && x.trim().toLowerCase() === e);
}

/** Méthode Valkyria écrite (Mandalart P1.1, P1.4.05, P1.5.01, P1.6) : règles pures, sans base de données.
 *  Les blocs de la séance reprennent les « places dans la séance » de la banque d'exercices (SESSION_PLACES). */

import { SESSION_PLACES, type SessionPlace } from "@/lib/exercise-bank";
import { PASSPORT_LEVELS, type PassportLevel } from "@/lib/skill-tests";

/* ── Structure de séance ─────────────────────────────────────────── */

export interface StructureBlock {
  place: SessionPlace | "retour";
  label: string;
  minutes: number;
  objective: string;
  rules: string;
}

/** Proposition de départ pour une pratique de 1 h 25 (à ajuster et valider par JP, P1.1.01). */
export const DEFAULT_STRUCTURE: StructureBlock[] = [
  { place: "jeu-entree", label: "Jeu d'entrée", minutes: 15, objective: "Activer et réveiller les filles par le jeu dès l'arrivée ; échauffement FIFA 11+ Kids intégré.", rules: "Un ballon par fille, aucune file d'attente." },
  { place: "ball-mastery", label: "Ball mastery", minutes: 20, objective: "Maîtrise du ballon : les gestes du passeport de leur niveau, beaucoup de touches.", rules: "Viser 500 touches par fille dans la séance ; explications de moins de 30 secondes." },
  { place: "technique", label: "Technique", minutes: 20, objective: "Le geste ou le thème de la semaine, en situation, avec sa progression (sur place, en mouvement, à vitesse, sous pression).", rules: "Dossards bicolores pour forcer la prise d'information." },
  { place: "forme-jouee", label: "Forme jouée", minutes: 25, objective: "Jouer : petits jeux avec prises de décision (3 contre 3 sur 4 mini-buts) ; vérifier que le thème passe dans le jeu.", rules: "Le coach parle moins de 20 % du temps ; questions plutôt que réponses." },
  { place: "retour", label: "Retour au calme et routine de fin", minutes: 5, objective: "Chaque fille donne sa note de la pratique et sa fatigue sur 10 ; un compliment précis à chacune.", rules: "Routine de fin saisie dans le portail." }
];

export const structureTotal = (blocks: Pick<StructureBlock, "minutes">[]) => blocks.reduce((s, b) => s + (Number(b.minutes) || 0), 0);

export const placeLabelOf = (place: StructureBlock["place"]) => (place === "retour" ? "Retour au calme" : SESSION_PLACES.find((p) => p.key === place)?.label ?? place);

/** Nettoie une structure envoyée par un formulaire (durées entières de 0 à 90 minutes). */
export function parseStructure(input: unknown): StructureBlock[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 10) return null;
  const places = new Set<string>([...SESSION_PLACES.map((p) => p.key), "retour"]);
  const out: StructureBlock[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const b = raw as Record<string, unknown>;
    const minutes = Math.round(Number(b.minutes));
    if (!places.has(String(b.place)) || !Number.isFinite(minutes) || minutes < 0 || minutes > 90) return null;
    out.push({
      place: b.place as StructureBlock["place"],
      label: String(b.label ?? "").trim().slice(0, 80) || placeLabelOf(b.place as StructureBlock["place"]),
      minutes,
      objective: String(b.objective ?? "").trim().slice(0, 1000),
      rules: String(b.rules ?? "").trim().slice(0, 1000)
    });
  }
  return out;
}

/* ── Principes Valkyria ──────────────────────────────────────────── */

export interface Principle {
  title: string;
  text: string;
}

/** Repris tels quels du plan Mandalart (P1.3.05, P1.3.06, P1.4.05, P1.5, P1.6) : à compléter par JP (P1.5.01). */
export const DEFAULT_PRINCIPLES: Principle[] = [
  { title: "Confiance et appartenance", text: "Chaque fille se sent à sa place dans le groupe ; l'erreur est valorisée, c'est comme ça qu'on apprend." },
  { title: "Chaque fille comparée à elle-même", text: "Dans les tests et les bulletins, on compare une fille à elle-même (son jour 1, son mois précédent), jamais aux autres." },
  { title: "Le cri Valkyria", text: "Après une erreur, le groupe rebondit ensemble avec le cri Valkyria." },
  { title: "500 touches par séance", text: "Un ballon par fille, aucune file d'attente, explications courtes." },
  { title: "Prévention", text: "L'échauffement FIFA 11+ Kids à chaque séance (prévention du ligament croisé)." },
  { title: "La règle du coach", text: "Parler moins de 20 % du temps, poser des questions, nommer chaque fille avec un compliment précis." },
  { title: "Prise d'information", text: "Dossards bicolores dans tous les exercices ; une forme jouée avec prises de décision dans chaque séance." }
];

/* ── Composantes obligatoires de chaque entraînement ─────────────── */

/** La ligne directrice que JP écrit point par point : ce que TOUT entraînement Valkyria doit contenir.
 *  Vide au départ (JP la remplit) ; ces idées, tirées du plan, ne sont qu'un point de départ à reprendre ou non. */
export const COMPONENT_IDEAS: Principle[] = [
  { title: "Échauffement FIFA 11+ Kids", text: "À chaque séance, intégré au jeu d'entrée (prévention du ligament croisé)." },
  { title: "Un ballon par fille", text: "Aucune file d'attente : viser 500 touches par fille." },
  { title: "Le thème de la semaine", text: "Le geste ou le thème du plan de l'année, avec sa progression." },
  { title: "Une forme jouée avec prises de décision", text: "Dossards bicolores, petits jeux, le thème doit passer dans le jeu." },
  { title: "Un compliment précis à chaque fille", text: "La nommer et dire exactement ce qu'elle a bien fait." },
  { title: "Le sondage de fin", text: "Présences, plaisir, fatigue et ce qu'elles veulent plus, avant de partir." }
];

export function parsePrinciples(input: unknown): Principle[] | null {
  if (!Array.isArray(input) || input.length > 30) return null;
  return input
    .map((p) => ({ title: String((p as Principle)?.title ?? "").trim().slice(0, 120), text: String((p as Principle)?.text ?? "").trim().slice(0, 1500) }))
    .filter((p) => p.title || p.text);
}

/* ── Bibliothèque des gestes ─────────────────────────────────────── */

export const GESTURE_FAMILIES = [
  { key: "semelle", label: "Semelle" },
  { key: "interieur-exterieur", label: "Intérieur / extérieur" },
  { key: "changements-direction", label: "Changements de direction" },
  { key: "feintes", label: "Feintes" },
  { key: "controles-orientes", label: "Contrôles orientés" }
] as const;
export type GestureFamily = (typeof GESTURE_FAMILIES)[number]["key"];
export const familyLabel = (k: string) => GESTURE_FAMILIES.find((f) => f.key === k)?.label ?? k;

export const PROGRESSION_STEPS = [
  { key: "sur-place", label: "Sur place" },
  { key: "en-mouvement", label: "En mouvement" },
  { key: "a-vitesse", label: "À vitesse" },
  { key: "sous-pression", label: "Sous pression ou en jeu" }
] as const;

export const GESTURES_PER_LEVEL = 5;

export interface Gesture {
  id: string;
  name: string;
  family: string;
  passport_level: PassportLevel | null;
  execution: string | null;
  key_points: string[];
  common_mistakes: string | null;
  video_url: string | null;
  progression: Partial<Record<(typeof PROGRESSION_STEPS)[number]["key"], string>>;
  sort_order: number;
  active: boolean;
  validated_at: string | null;
}

/** Fiche complète (P1.1.04, P1.1.05) : exécution, 3 points clés, erreurs, vidéo, 4 étapes de progression. */
export function gestureChecklist(g: Pick<Gesture, "execution" | "key_points" | "common_mistakes" | "video_url" | "progression" | "passport_level">) {
  const filled = (s: string | null | undefined) => Boolean(s && s.trim());
  const items = [
    { label: "Niveau du passeport", ok: Boolean(g.passport_level) },
    { label: "Exécution", ok: filled(g.execution) },
    { label: "3 points clés", ok: (g.key_points ?? []).filter((k) => filled(k)).length >= 3 },
    { label: "Erreurs fréquentes", ok: filled(g.common_mistakes) },
    { label: "Vidéo de démonstration", ok: filled(g.video_url) },
    { label: "Progression en 4 étapes", ok: PROGRESSION_STEPS.every((s) => filled(g.progression?.[s.key])) }
  ];
  return { items, done: items.filter((i) => i.ok).length, total: items.length, missing: items.filter((i) => !i.ok).map((i) => i.label) };
}

/** Les 5 gestes de base par niveau du passeport (P1.1.02) : combien sont choisis à chaque niveau. */
export function gesturesPerLevel(gestures: Pick<Gesture, "passport_level" | "active">[]) {
  return PASSPORT_LEVELS.map((level) => {
    const count = gestures.filter((g) => g.active && g.passport_level === level).length;
    return { level, count, target: GESTURES_PER_LEVEL, complete: count >= GESTURES_PER_LEVEL };
  });
}

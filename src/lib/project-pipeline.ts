import type { LaunchInputs, LaunchResults } from "@/lib/launch-calculator";

/** Projets à lancer (JP, 17 nov. 2026) : « savoir ce qui peut potentiellement marcher » avant de lancer.
 *  Chaque projet est une question du sondage d'intérêt aux familles ; son scénario du calculateur de lancement
 *  (prix, places, coûts, heures de JP) dit s'il vaut la peine. Ici, rien que des règles pures : la page
 *  /admin/revenus/projets croise les réponses, le calcul et les heures de JP, puis place les étapes dans les tâches de JP. */

export interface Project {
  key: string;
  label: string;
  /** Quand, en mots (« entre Noël et le jour de l'An »). */
  when: string;
  /** Date de début proposée au calculateur (modifiable) ; null = à fixer. */
  start: string | null;
  /** Projet qui existe déjà (la saison) : on mesure l'intention de rester, pas un lancement. */
  existing?: boolean;
}

export const PROJECTS_2027: Project[] = [
  { key: "camp-fetes-2026", label: "Camp des Fêtes", when: "entre Noël et le jour de l'An (décembre 2026)", start: "2026-12-28" },
  { key: "camp-releche-2027", label: "Camp de la semaine de relâche", when: "semaine de relâche, mars 2027", start: "2027-03-01" },
  { key: "camp-ete-2027", label: "Camp de jour de l'été", when: "été 2027, à la semaine", start: "2027-06-28" },
  { key: "haute-performance", label: "Programme haute performance", when: "pour les joueuses qui veulent aller plus loin, dès 2027", start: null },
  { key: "roses", label: "Camp ou séances avec les Roses de Montréal", when: "en partenariat avec le club professionnel, 2027", start: null },
  { key: "ontario-ete-2027", label: "Tournée de tournois en Ontario (été)", when: "été 2027", start: null },
  { key: "ontario-automne-2027", label: "Tournée de tournois en Ontario (automne)", when: "automne 2027", start: null },
  { key: "prep-sport-etudes", label: "Programme préparatoire au Sport-Études", when: "avant les tests d'admission", start: null },
  { key: "saison-2027-2028", label: "Rester avec nous la saison prochaine", when: "automne-hiver 2027-2028", start: "2027-09-07", existing: true }
];

export const INTEREST_OPTIONS = ["Oui, très intéressée", "Peut-être", "Non"] as const;

/** Part des « oui » et des « peut-être » qui finissent par s'inscrire (prudent : un « oui » au sondage n'est pas un paiement). */
export const YES_CONVERSION = 0.5;
export const MAYBE_CONVERSION = 0.15;
/** Ce qu'une heure de JP doit rapporter au minimum : 10 000 $ par mois de salaire visé (P7.8.05) sur environ 200 heures. */
export const JP_HOUR_TARGET_CENTS = 5_000;

export interface Interest {
  yes: number;
  maybe: number;
  no: number;
  answered: number;
}

/** Compte les réponses d'une question de projet (texte de l'option choisie). */
export function countInterest(answers: unknown[]): Interest {
  const out: Interest = { yes: 0, maybe: 0, no: 0, answered: 0 };
  for (const a of answers) {
    const v = String(Array.isArray(a) ? a[0] ?? "" : a ?? "").trim().toLowerCase();
    if (!v) continue;
    out.answered++;
    if (v.startsWith("oui")) out.yes++;
    else if (v.startsWith("peut")) out.maybe++;
    else out.no++;
  }
  return out;
}

export function probableSignups(i: Interest, capacity?: number): number {
  const n = Math.floor(i.yes * YES_CONVERSION + i.maybe * MAYBE_CONVERSION + 1e-9);
  return capacity && capacity > 0 ? Math.min(n, capacity) : n;
}

export type Decision = "lancer" | "a-risque" | "pas-assez" | "non" | "a-chiffrer" | "en-attente";

export const DECISION_LABEL: Record<Decision, string> = {
  lancer: "À lancer",
  "a-risque": "À risque",
  "pas-assez": "Pas assez d'intérêt",
  non: "Pas rentable",
  "a-chiffrer": "À chiffrer",
  "en-attente": "En attente des réponses"
};

const RANK: Record<Decision, number> = { lancer: 0, "a-risque": 1, "a-chiffrer": 2, "en-attente": 3, "pas-assez": 4, non: 5 };

export interface ProjectEvaluation {
  decision: Decision;
  probable: number;
  breakEven: number | null;
  /** Bénéfice si les inscrites probables paient (avant le salaire de JP). */
  profitCents: number | null;
  profitPerJpHourCents: number | null;
  sentence: string;
}

const money = (c: number) => `${Math.round(c / 100).toLocaleString("fr-CA")} $`;

export function evaluateProject(interest: Interest, scenario: { inputs: LaunchInputs; results: LaunchResults } | null): ProjectEvaluation {
  const probable0 = probableSignups(interest);
  if (!scenario || !scenario.results.ready) {
    const who = interest.yes + interest.maybe;
    return {
      decision: interest.answered ? "a-chiffrer" : "en-attente",
      probable: probable0,
      breakEven: null,
      profitCents: null,
      profitPerJpHourCents: null,
      sentence: interest.answered
        ? `${who} famille${who > 1 ? "s" : ""} intéressée${who > 1 ? "s" : ""} : mettre le prix, les places et les coûts pour savoir s'il vaut la peine.`
        : "Aucune réponse pour l'instant : le chiffrer quand même, l'intérêt viendra du sondage."
    };
  }
  const { inputs, results } = scenario;
  const probable = probableSignups(interest, inputs.capacity);
  const profit = probable * results.contributionCents - results.fixedCents;
  const perHour = inputs.jpHours > 0 ? Math.round(profit / inputs.jpHours) : null;
  const base = { probable, breakEven: results.breakEvenCount, profitCents: profit, profitPerJpHourCents: perHour };
  if (results.economicVerdict === "no-go" || results.breakEvenCount === null) {
    return { ...base, decision: "non", sentence: "Même à 70 % de remplissage, la marge n'y est pas : monter le prix, baisser les coûts ou laisser tomber." };
  }
  if (!interest.answered) {
    return { ...base, decision: "en-attente", sentence: `Rentable sur papier à partir de ${results.breakEvenCount} inscrites : attendre les réponses du sondage avant de lancer.` };
  }
  if (probable < results.breakEvenCount) {
    return { ...base, decision: "pas-assez", sentence: `${probable} inscrite${probable > 1 ? "s" : ""} probable${probable > 1 ? "s" : ""} pour ${results.breakEvenCount} nécessaires : pas assez d'intérêt pour l'instant (relancer, élargir aux nouvelles familles ou reporter).` };
  }
  if (perHour !== null && perHour < JP_HOUR_TARGET_CENTS) {
    return { ...base, decision: "a-risque", sentence: `Rentable (${money(profit)} de bénéfice probable) mais ${money(perHour)} par heure de ton temps, sous ${money(JP_HOUR_TARGET_CENTS)} : déléguer une partie ou monter le prix.` };
  }
  if (results.economicVerdict === "risque" || profit <= 0) {
    return { ...base, decision: "a-risque", sentence: `Marge mince : ${money(profit)} de bénéfice probable. À lancer seulement avec des préventes.` };
  }
  return {
    ...base,
    decision: "lancer",
    sentence: `${money(profit)} de bénéfice probable${perHour !== null ? `, soit ${money(perHour)} par heure de ton temps` : ""} : à lancer, les familles intéressées en premier.`
  };
}

export function sortByDecision<T extends { evaluation: ProjectEvaluation }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => RANK[a.evaluation.decision] - RANK[b.evaluation.decision] || (b.evaluation.profitCents ?? -Infinity) - (a.evaluation.profitCents ?? -Infinity));
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface AgendaStep {
  key: "prep" | "vente" | "preventes";
  title: string;
  due: string;
  details: string;
}

/** Les trois étapes d'un projet retenu, à placer dans les tâches de JP (règle d'anticipation : préparer 2 mois avant). */
export function agendaSteps(label: string, start: string, today: string): AgendaStep[] {
  const at = (n: number) => {
    const d = addDays(start, -n);
    return d < today ? today : d;
  };
  return [
    { key: "prep", title: `Préparer : ${label}`, due: at(60), details: `Fixer le lieu, les dates, les éducateurs et le prix (calculateur de lancement), puis la page d'inscription. Début prévu le ${start}.` },
    { key: "vente", title: `Ouvrir la vente : ${label}`, due: at(45), details: "Écrire d'abord aux familles qui ont répondu « Oui » au sondage, avec un prix hâtif, puis aux autres." },
    { key: "preventes", title: `Vérifier les préventes : ${label}`, due: at(14), details: "Sous le seuil de survie du calculateur : reporter, fusionner ou annuler. Au-dessus : confirmer les éducateurs et le matériel." }
  ];
}

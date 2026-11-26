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
  /** Financement possible en dehors des inscriptions (proposition Azimut Nexus Conseil du 6 nov. 2026). */
  funding?: string;
  /** Prix du marché relevés (sites des concurrents, 17 nov. 2026) et prix visé pour 50 % de marge. */
  market?: string;
  /** Proposé seulement aux familles dont l'invitation porte ce repère (sinon à toutes). */
  segment?: string;
  /** Sondé à part (son propre sondage, ex. le tournoi des équipes avancées) : absent de la liste à cocher commune. */
  ownSurvey?: boolean;
  /** Projet écarté (raison et date) : il reste visible, sans agenda, et sort des prochains sondages. */
  dropped?: string;
  /** Idée ajoutée d'après les réponses des familles (pourquoi elle est proposée). Pas encore sondée en tant que telle. */
  proposed?: string;
}

/** Repère des familles d'une fille née du 1er oct. 2015 au 30 sept. 2016 (âge au 30 septembre) : 6e année en 2027-2028,
 *  tests Sport-Études à l'automne 2027 pour le secondaire 1 en 2028. */
export const SEGMENT_6E_2027 = "Entrée en 6e en 2027";
/** Repère des familles d'une joueuse des équipes avancées de MonClubSportif (Équipe 2015 AV, Équipe 2016-2017 AV). */
export const SEGMENT_AVANCEE = "Équipe avancée";
/** Une seule question à cocher pour tous les projets (JP, 17 nov. 2026 : un seul formulaire, pas un sondage par projet). */
export const PROJECT_CHECKLIST_ID = "interets";
export const projectOption = (p: Project) => `${p.label} (${p.when})`;

export const PROJECTS_2027: Project[] = [
  { key: "camp-fetes-2026", label: "Camp des Fêtes", when: "entre Noël et le jour de l'An 2026", start: "2026-12-28", dropped: "Écarté par JP le 20 nov. 2026 : 5 familles sur 30 intéressées, aucune vente réaliste pour les Fêtes.", funding: "Fondation Bon départ (Canadian Tire) : jusqu'à 300 $ par joueuse par année, demandé par la famille." },
  { key: "camp-releche-2027", label: "Camp de la semaine de relâche", when: "mars 2027", start: "2027-03-01" },
  { key: "camp-ete-2027", label: "Camp de jour de l'été", when: "été 2027, à la semaine", start: "2027-06-28", funding: "Emplois d'été Canada : jusqu'à 50 % du salaire minimum des moniteurs de 15 à 30 ans salariés (demande l'hiver d'avant). Bon départ pour les familles.", market: "Écoles de Soccer Montréal : 249 $ la semaine (9 h à 12 h), 349 $ la journée complète ; camp féminin Roses FC × EDSM : 529 $ la semaine (filles de 7 à 13 ans, 9 h à 15 h, Laval et Brossard), + 50 $ d'équipement. Pour nous (journée de 6 h, 24 filles, 2 éducatrices, synthétique à 41,53 $/h) : GO à partir de 504 $ ; 529 $ + équipement = environ 4 400 $ de bénéfice par semaine à 70 % de remplissage. Avec la TPS/TVQ (prochaine saison), 504 $ gardés = 579 $ payés par la famille, alors que leurs camps sont exonérés : se démarquer par la valeur, ou voir avec le CPA si un camp d'enfants peut être exonéré (piste OBNL d'Azimut)." },
  { key: "haute-performance", label: "Programme haute performance", when: "pour les joueuses qui veulent aller plus loin, dès 2027", start: null },
  { key: "roses", label: "Camp ou séances avec les Roses de Montréal", when: "en partenariat avec le club professionnel, 2027", start: null, market: "Les Roses ont déjà un camp féminin avec Écoles de Soccer Montréal (529 $ la semaine, Laval et Brossard). Notre angle : leur ouvrir les Laurentides, où elles n'ont pas de camp." },
  { key: "clinique-roses", label: "Clinique d'une journée avec les Roses de Montréal", when: "relâche ou printemps 2027, dans les Laurentides", start: "2027-03-03", proposed: "27 familles sur 30 veulent les Roses : une journée avec leurs joueuses ou leurs entraîneurs se monte plus vite qu'un camp, coûte moins cher et ouvre la porte au partenariat (premier contact : tâche urgente de JP)." },
  { key: "semaine-hp-ete", label: "Semaine haute performance d'été", when: "été 2027, une semaine intensive pour les joueuses qui veulent aller plus loin", start: "2027-07-05", proposed: "25 familles sur 30 veulent la haute performance et 15 le camp d'été : une semaine intensive réunit les deux, au prix d'un programme élite." },
  { key: "ontario-ete-2027", label: "Tournée de tournois en Ontario", when: "été 2027", start: null, funding: "Hors Québec : rarement admissible aux subventions. Commanditaire présentateur, levées de fonds, part des parents annoncée tôt." },
  { key: "ontario-automne-2027", label: "Tournée de tournois en Ontario", when: "automne 2027", start: null, funding: "Hors Québec : rarement admissible aux subventions. Commanditaire présentateur, levées de fonds, part des parents annoncée tôt." },
  { key: "tournoi-av-ontario", label: "Tournoi Game Awareness avec l'équipe avancée", when: "Mississauga, 2027 (sondage à part des équipes 2015 AV et 2016-2017 AV)", start: null, segment: "Équipe avancée", ownSurvey: true, market: "Inscription par équipe, taxes incluses : 9 contre 9 de 757 $ à 1 100 $, 7 contre 7 de 616 $ à 894 $ selon le tournoi (Family Day Cup 14-15 févr., Easter Cup 29 mars, Youth World Cup 3-4 juill., Youth Gold Cup 4 sept., Thanksgiving Cup 11 oct.). Hôtel et transport en plus.", funding: "Hors Québec : rarement admissible aux subventions. Commanditaire présentateur, levées de fonds, part des parents annoncée tôt." },
  { key: "prep-sport-etudes", label: "Programme préparatoire au Sport-Études", when: "pour les tests de l'automne 2027, entrée au secondaire en 2028", start: null, segment: "Entrée en 6e en 2027" },
  { key: "saison-2027-2028", label: "Continuer avec New Valkyria la saison prochaine", when: "automne-hiver 2027-2028", start: "2027-09-07", existing: true }
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
  /** Bénéfice probable + subvention attendue, quand elle n'est pas comptée dans le calcul (« Compter la subvention » décoché). */
  profitWithGrantCents: number | null;
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
      profitWithGrantCents: null,
      sentence: interest.answered
        ? `${who} famille${who > 1 ? "s" : ""} intéressée${who > 1 ? "s" : ""} : mettre le prix, les places et les coûts pour savoir s'il vaut la peine.`
        : "Aucune réponse pour l'instant : le chiffrer quand même, l'intérêt viendra du sondage."
    };
  }
  const { inputs, results } = scenario;
  const probable = probableSignups(interest, inputs.capacity);
  // La subvention comptée (grantCounted) est un revenu fixe de plus, déjà dans le verdict du calculateur.
  const profit = probable * results.contributionCents - results.fixedCents + results.grantCents;
  const perHour = inputs.jpHours > 0 ? Math.round(profit / inputs.jpHours) : null;
  const base = { probable, breakEven: results.breakEvenCount, profitCents: profit, profitPerJpHourCents: perHour, profitWithGrantCents: inputs.grantCents && !inputs.grantCounted ? profit + inputs.grantCents : null };
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

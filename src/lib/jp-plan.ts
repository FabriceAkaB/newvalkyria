/** « Mon plan » (espace JP) : le plan de 6 mois découpé semaine par semaine en quelques pièces claires.
 *  Chaque pièce dit pourquoi, quand (le bloc du calendrier Google), quoi faire en petites étapes et à quoi on voit
 *  que c'est fini. Les étapes cochées vivent dans `app_settings` « jp_plan_checks » ; une pièce liée au Mandalart
 *  coche ses tâches quand sa dernière étape est cochée (ou quand la tâche est déjà faite dans le Mandalart).
 *  Règle de JP pour l'agenda : le plus difficile le matin, le plus facile vers la fin (créer → vendre → appels →
 *  finir/approuver → montage, relances, logistique → formation). Seuls le terrain, les parascolaires et les appels
 *  du soir aux familles ont une heure imposée.
 *  Règles pures ici ; lecture et écriture dans `jp-repo.ts`. */

export interface PlanLink {
  label: string;
  href: string;
}

export interface PlanStep {
  id: string;
  text: string;
  link?: PlanLink;
}

export interface PlanPiece {
  id: string;
  title: string;
  /** Une phrase : pourquoi c'est important maintenant. */
  why: string;
  /** Le bloc du calendrier où ça se fait. */
  when: string;
  /** À quoi on voit que c'est fini. */
  doneWhen: string;
  /** Tâches du Mandalart cochées quand la pièce est finie. */
  codes: string[];
  star?: boolean;
  steps: PlanStep[];
}

export interface PlanWeek {
  n: number;
  start: string;
  end: string;
  title: string;
  /** Ce qu'on vend cette semaine (bloc 🧲 du matin). */
  sell: string;
  pieces: PlanPiece[];
}

const CLAUDE = "Ouvre Claude (sur ton Mac, ou ton téléphone relié au Mac) et écris :";

export const PLAN: PlanWeek[] = [
  {
    n: 1,
    start: "2026-11-11",
    end: "2026-11-15",
    title: "Les pratiques d'abord",
    sell: "La demi-saison filles (15 places) et les places garçons 2014. Vérifie chaque joueuse par son nom avant d'écrire.",
    pieces: [
      {
        id: "s1-pratiques",
        title: "Monter toutes les pratiques jusqu'au 19 décembre",
        why: "Tu es sur le terrain presque tous les soirs. Une pratique prête d'avance = pas d'improvisation et tes matins libres pour vendre.",
        when: "Mercredi 11 nov. 5 h 45 et 13 h 30, jeudi 12 nov. 5 h 45 et 10 h. Pas fini ? Vendredi 13, 5 h 45.",
        doneWhen: "La page Pratiques n'a plus aucune pratique en rouge ni en jaune jusqu'au 19 décembre.",
        codes: [],
        star: true,
        steps: [
          { id: "s1-p1", text: "Ouvre la page Pratiques et regarde combien sont en rouge (2 min).", link: { label: "Pratiques", href: "/admin/pratiques" } },
          { id: "s1-p2", text: `${CLAUDE} « Monte mes pratiques du 11 au 22 novembre », celle de ce soir en premier. Claude prépare les diapos.` },
          { id: "s1-p3", text: "Regarde chaque pratique 5 minutes. Réponds « OK » ou dis ce qu'il faut changer." },
          { id: "s1-p4", text: "Même chose pour le 23 novembre au 6 décembre." },
          { id: "s1-p5", text: "Même chose pour le 7 au 19 décembre. Vérifie que tout est vert.", link: { label: "Pratiques", href: "/admin/pratiques" } }
        ]
      },
      {
        id: "s1-noel",
        title: "Écrire l'offre de la carte-cadeau de Noël",
        why: "C'est le cash des Fêtes : la carte-cadeau « Semaine de camp Valkyria » se lance le 5 décembre.",
        when: "Vendredi 13 nov., 5 h 45, dès que les pratiques sont finies. Sinon lundi 16, 5 h 45.",
        doneWhen: "Le prix, ce que contient la carte et le texte de la page sont approuvés par toi.",
        codes: [],
        steps: [
          { id: "s1-n1", text: "Décide le prix et ce que la carte donne (une semaine de camp d'été 2027)." },
          { id: "s1-n2", text: `${CLAUDE} « Écris l'offre et la page de la carte-cadeau de Noël ».` },
          { id: "s1-n3", text: "Relis la page 10 minutes et réponds « OK » ou corrige." }
        ]
      }
    ]
  },
  {
    n: 2,
    start: "2026-11-16",
    end: "2026-11-22",
    title: "Fiche Google, CPA et vidéos",
    sell: "Les 33 plages de match aux clubs, les commandites 2027 (10 emplacements) et Nexus.",
    pieces: [
      {
        id: "s2-google",
        title: "Créer la fiche Google de l'académie",
        why: "Les parents cherchent « soccer filles Sainte-Thérèse » sur Google : sans fiche, tu n'existes pas.",
        when: "Vendredi 20 nov., 5 h 45 (bloc 🐸).",
        doneWhen: "La fiche est créée et la validation est demandée à Google.",
        codes: ["P3.8.06"],
        star: true,
        steps: [
          { id: "s2-g1", text: "Va sur business.google.com avec le compte info@newvalkyria.com." },
          { id: "s2-g2", text: `${CLAUDE} « Écris la description de ma fiche Google ». Colle-la, catégorie École de sport, villes desservies.` },
          { id: "s2-g3", text: "Ajoute 10 photos (seulement des familles qui ont accepté les photos)." },
          { id: "s2-g4", text: "Demande la validation (carte postale ou vidéo)." }
        ]
      },
      {
        id: "s2-cpa",
        title: "Donner les vrais coûts au CPA et signer le mandat",
        why: "Sans les vrais coûts, impossible de fixer les prix de l'été 2027 au bon niveau.",
        when: "Mardi 17 nov., 11 h (bloc BÂTIR). Ou confie-le à Christine.",
        doneWhen: "Pontbriand Lamarche a reçu les coûts et le mandat est signé.",
        codes: ["P7.2.01", "P7.1.01"],
        steps: [
          { id: "s2-c1", text: "Note les coûts : gymnase de Prévost, taux et heures de Noura, paie d'Annie, ta paie." },
          { id: "s2-c2", text: "Envoie-les à Pontbriand Lamarche (ou confie l'envoi à Christine dans Ma journée)." },
          { id: "s2-c3", text: "Signe le mandat." }
        ]
      },
      {
        id: "s2-publier",
        title: "Publier 3 vidéos cette semaine",
        why: "Le plan : publier dès le 15 novembre et ne plus jamais arrêter.",
        when: "Lundi 16 nov., 7 h 30 tournage, 12 h 30 montage.",
        doneWhen: "3 vidéos publiées sur les comptes de l'académie.",
        codes: ["P3.2.06"],
        steps: [
          { id: "s2-v1", text: "Vidéo 1 publiée (lundi)." },
          {
            id: "s2-formation",
            text: "⭐ Formation prioritaire : regarde la vidéo sur le personal branding (lundi et mardi, 21 h 30). Note 3 idées dans Mes connaissances et choisis celle que tu appliques au tournage de jeudi.",
            link: { label: "la formation", href: "https://youtu.be/Ch4Sl0POBhU" }
          },
          { id: "s2-v2", text: "Vidéo 2 publiée (mercredi)." },
          {
            id: "s2-storytelling",
            text: "⭐ Formation prioritaire : regarde la vidéo sur le storytelling (mercredi, 21 h 30). Note 3 idées et écris en 3 lignes l'histoire du tournage de jeudi (début, problème, ce qui a changé).",
            link: { label: "la formation", href: "https://youtu.be/hNuAv-42jzY" }
          },
          { id: "s2-v3", text: "Vidéo 3 publiée (vendredi)." }
        ]
      }
    ]
  },
  {
    n: 3,
    start: "2026-11-23",
    end: "2026-11-29",
    title: "La méthode Valkyria sur papier",
    sell: "Les plages de match aux clubs et les commandites 2027.",
    pieces: [
      {
        id: "s3-structure",
        title: "La structure de séance Valkyria sur une page",
        why: "Les éducateurs font tous la même séance, même quand tu n'es pas là.",
        when: "Lundi 23 nov., 5 h 45 (bloc 🐸).",
        doneWhen: "Une page avec chaque bloc de la séance et sa durée, approuvée par toi.",
        codes: ["P1.1.01"],
        star: true,
        steps: [
          { id: "s3-s1", text: `${CLAUDE} « Fais la page de structure de séance à partir de mes pratiques ».` },
          { id: "s3-s2", text: "Relis et réponds « OK » ou corrige." }
        ]
      },
      {
        id: "s3-passeport",
        title: "Les 5 gestes par niveau et les tests du passeport",
        why: "Le passeport montre aux parents que leur fille progresse : c'est ce qui les fait réinscrire.",
        when: "Mardi 24 au jeudi 26 nov., 5 h 45 (bloc 🐸).",
        doneWhen: "5 gestes et 1 test choisis pour bronze, argent, or et mauve.",
        codes: ["P1.1.02", "P1.2.01"],
        steps: [
          { id: "s3-t1", text: "Choisis 5 gestes pour chaque niveau (bronze, argent, or, mauve)." },
          { id: "s3-t2", text: "Choisis le test de chaque niveau (touches en 30 s, conduite chronométrée, passes des deux pieds)." },
          { id: "s3-t3", text: `${CLAUDE} « Range mes gestes et mes tests dans le passeport ».` }
        ]
      },
      {
        id: "s3-fiche",
        title: "Le gabarit de fiche d'exercice",
        why: "Chaque exercice de la banque se lit de la même façon.",
        when: "Vendredi 27 nov., 5 h 45 (bloc 🐸).",
        doneWhen: "Le gabarit est approuvé et utilisé dans la banque d'exercices.",
        codes: ["P1.3.01"],
        steps: [
          { id: "s3-f1", text: `${CLAUDE} « Montre-moi le gabarit de fiche d'exercice ».` },
          { id: "s3-f2", text: "Réponds « OK » ou corrige.", link: { label: "Banque d'exercices", href: "/admin/exercices" } }
        ]
      }
    ]
  },
  {
    n: 4,
    start: "2026-11-30",
    end: "2026-12-06",
    title: "Carte-cadeau en ligne",
    sell: "La carte-cadeau de Noël (dès le 5), le camp des Fêtes, les commandites et les plages de Terrebonne.",
    pieces: [
      {
        id: "s4-carte",
        title: "Mettre la carte-cadeau en vente le 5 décembre",
        why: "Noël, c'est maintenant ou dans un an.",
        when: "Lundi 30 nov. au jeudi 3 déc., 5 h 45 (bloc 🐸). Lancement samedi 5 déc.",
        doneWhen: "La carte-cadeau se paie en ligne et le courriel aux familles est parti le 5.",
        codes: ["P5.2.01"],
        star: true,
        steps: [
          { id: "s4-c1", text: `${CLAUDE} « Mets la carte-cadeau en ligne avec son paiement ».` },
          { id: "s4-c2", text: "Fais un achat test et vérifie que tu reçois l'avis." },
          { id: "s4-c3", text: "Approuve le courriel aux familles (Claude l'envoie le 5)." }
        ]
      },
      {
        id: "s4-mcs",
        title: "Lister ce que tu fais encore à la main dans MonClubSportif",
        why: "Chaque tâche de la liste devient une tâche du robot : moins de soirées perdues.",
        when: "Vendredi 4 déc., 5 h 45 (bloc 🐸).",
        doneWhen: "La liste est écrite et donnée à Claude.",
        codes: ["P8.4.04"],
        steps: [
          { id: "s4-m1", text: "Pendant la semaine, note chaque fois que tu touches MonClubSportif à la main." },
          { id: "s4-m2", text: `${CLAUDE} « Voici ce que je fais à la main dans MCS » et colle ta liste.` }
        ]
      }
    ]
  },
  {
    n: 5,
    start: "2026-12-07",
    end: "2026-12-13",
    title: "Mise en vente de l'été 2027",
    sell: "La carte-cadeau de Noël, le camp des Fêtes et les commandites.",
    pieces: [
      {
        id: "s5-ete",
        title: "Préparer la vente de l'été 2027 (prête le 15 décembre)",
        why: "L'été, c'est la plus grosse part de l'argent de 2027 : il se vend un mois d'avance.",
        when: "Lundi 7 au vendredi 11 déc., 5 h 45 (bloc 🐸).",
        doneWhen: "Prix, dates, pages et courriel de l'été 2027 approuvés par toi.",
        codes: ["P2.5.01", "P2.4.06", "P2.4.05"],
        star: true,
        steps: [
          { id: "s5-e1", text: `${CLAUDE} « Calcule mes prix planchers de l'été 2027 avec les vrais coûts ».` },
          { id: "s5-e2", text: "Choisis les prix et le bonus (garantie, rareté, date limite)." },
          { id: "s5-e3", text: `${CLAUDE} « Prépare les pages et le courriel de l'été 2027 ».` },
          { id: "s5-e4", text: "Relis et réponds « OK »." }
        ]
      }
    ]
  },
  {
    n: 6,
    start: "2026-12-14",
    end: "2026-12-19",
    title: "Sondages et camps des Fêtes",
    sell: "La carte-cadeau de Noël, le camp des Fêtes et l'été 2027 (en vente le 15).",
    pieces: [
      {
        id: "s6-sondages",
        title: "Envoyer les 2 sondages le 15 décembre",
        why: "Savoir ce que les familles veulent avant de leur vendre l'été.",
        when: "Lundi 14 déc., 5 h 45 (bloc 🐸). Envoi le 15.",
        doneWhen: "Les 2 sondages sont partis et 70 % des familles ont répondu.",
        codes: ["P4.8.07", "P4.8.09"],
        star: true,
        steps: [
          { id: "s6-s1", text: `${CLAUDE} « Prépare le sondage de mi-saison et le sondage d'intérêt pour l'été ».`, link: { label: "Sondages", href: "/admin/sondages" } },
          { id: "s6-s2", text: "Approuve les questions. Claude les envoie le 15." },
          { id: "s6-s3", text: "Le 18 : relance les familles qui n'ont pas répondu." }
        ]
      },
      {
        id: "s6-camps",
        title: "Prévente des camps prête le 20 décembre",
        why: "Les familles décident de l'été pendant les Fêtes.",
        when: "Mercredi 16 au vendredi 18 déc., 5 h 45 (bloc 🐸).",
        doneWhen: "La page de prévente des camps est en ligne.",
        codes: [],
        steps: [
          { id: "s6-c1", text: `${CLAUDE} « Ouvre la prévente des camps d'été ».` },
          { id: "s6-c2", text: "Relis et réponds « OK »." }
        ]
      }
    ]
  }
];

export type Checks = Record<string, boolean>;

/** La semaine du plan qui contient `today` (ou la prochaine, avant le début ; null après la fin). */
export function weekOf(today: string, plan: PlanWeek[] = PLAN): PlanWeek | null {
  return plan.find((w) => today <= w.end) ?? null;
}

export function isPieceDone(piece: PlanPiece, checks: Checks, doneCodes: Set<string>): boolean {
  if (piece.codes.length && piece.codes.every((c) => doneCodes.has(c))) return true;
  return piece.steps.every((s) => checks[s.id]);
}

export function pieceProgress(piece: PlanPiece, checks: Checks, doneCodes: Set<string>): { done: number; total: number; finished: boolean } {
  const finished = isPieceDone(piece, checks, doneCodes);
  const total = piece.steps.length;
  return { done: finished ? total : piece.steps.filter((s) => checks[s.id]).length, total, finished };
}

/** Les pièces des semaines passées qui ne sont pas finies : à rattraper avant le reste. */
export function leftovers(today: string, checks: Checks, doneCodes: Set<string>, plan: PlanWeek[] = PLAN): PlanPiece[] {
  return plan.filter((w) => w.end < today).flatMap((w) => w.pieces.filter((p) => !isPieceDone(p, checks, doneCodes)));
}

/** La prochaine action, une seule : la première étape pas cochée, en commençant par ce qui est en retard,
 *  puis la pièce ⭐ de la semaine, puis les autres pièces dans l'ordre. */
export function nextAction(today: string, checks: Checks, doneCodes: Set<string>, plan: PlanWeek[] = PLAN): { piece: PlanPiece; step: PlanStep; late: boolean } | null {
  const late = leftovers(today, checks, doneCodes, plan);
  const week = weekOf(today, plan);
  const current = week ? [...week.pieces].sort((a, b) => Number(!!b.star) - Number(!!a.star)) : [];
  for (const [list, isLate] of [
    [late, true],
    [current, false]
  ] as const) {
    for (const piece of list) {
      if (isPieceDone(piece, checks, doneCodes)) continue;
      const step = piece.steps.find((s) => !checks[s.id]);
      if (step) return { piece, step, late: isLate };
    }
  }
  return null;
}

/** La pièce à laquelle appartient une étape. */
export function pieceOfStep(stepId: string, plan: PlanWeek[] = PLAN): PlanPiece | null {
  for (const w of plan) for (const p of w.pieces) if (p.steps.some((s) => s.id === stepId)) return p;
  return null;
}

/** Parse le réglage enregistré (JSON) sans jamais planter. */
export function parseChecks(raw: unknown): Checks {
  if (!raw) return {};
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x === true)) as Checks;
  } catch {
    return {};
  }
}

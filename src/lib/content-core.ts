/** Espace « Création de contenu » (règles pures, testées). Tout ce qui sert à filmer, raconter et publier :
 *  quotas de la semaine de la personne caméra, protocole du ball mastery à 360°, projet entrevues avant/après
 *  (P8.1, P3.2.07, P3.2.08) et calendrier de publication (P3.2.06). Les tournages vivent dans jp_video_shoots,
 *  les publications et leurs chiffres dans marketing_posts (marketing-posts-core.ts) : rien n'est recopié ici. */

import { WEEKLY_IDEAL, WEEKLY_TARGET } from "@/lib/marketing-posts-core";

/** La personne qui filme (le coach coache, elle filme au maximum). */
export const DEFAULT_FILMER = "William";

/** Objectif du projet entrevues : 30 filles d'ici la fin de la saison (P8.1.02, indicateur entrevues_saison). */
export const INTERVIEW_GOAL = 30;
export const INTERVIEWS_START = "2026-11-21";
export const SEASON_END = "2027-04-18";

export type PostKind = "organique" | "essai" | "pub";
export const POST_KINDS: { id: PostKind; label: string; help: string }[] = [
  { id: "organique", label: "Organique", help: "Publication normale sur nos comptes." },
  { id: "essai", label: "Reel d'essai", help: "Un test (accroche, format, angle) montré d'abord à un petit public, gardé seulement s'il marche." },
  { id: "pub", label: "Publicité", help: "Contenu payant (P3.8) : budget, cible et inscriptions mesurés dans Réseaux sociaux." }
];
export const postKindLabel = (k: string | null | undefined) => POST_KINDS.find((x) => x.id === k)?.label ?? "Organique";

/** Angles marketing (Hormozi, $100M Leads et Offers) : chaque publication en choisit un. */
export const ANGLES = [
  "Preuve (avant/après, résultat)",
  "Témoignage d'un parent",
  "Coulisses d'une pratique",
  "Éducatif (un geste expliqué)",
  "Offre (évaluation gratuite, essai)",
  "Appartenance (Valkyria Family)",
  "Urgence (places limitées, date)"
];

/** Quotas de la semaine pour la personne caméra. Le ball mastery se filme à chaque pratique. */
export interface WeekQuota {
  key: string;
  label: string;
  done: number;
  target: number;
  ideal?: number;
  help: string;
}

export function weekQuotas(input: { published: number; practices: number; captured360: number; matches: number; matchPhotos: number; veoPractices: number; interviewsFilmed: number; interviewsPerWeek: number }): WeekQuota[] {
  return [
    { key: "publications", label: "Publications", done: input.published, target: WEEKLY_TARGET, ideal: WEEKLY_IDEAL, help: `${WEEKLY_TARGET} vidéos par semaine, idéal ${WEEKLY_IDEAL} (P3.2.01).` },
    { key: "ball360", label: "Ball mastery filmé à 360°", done: input.captured360, target: input.practices, help: "Chaque pratique en gymnase de la semaine." },
    { key: "photos", label: "Photos des joueuses aux matchs", done: input.matchPhotos, target: input.matches, help: "Chaque match : chaque joueuse en photo (portrait et en action)." },
    { key: "veo", label: "Pratique filmée avec la Veo", done: input.veoPractices, target: 1, help: "Au moins une pratique par semaine, vue d'ensemble pour l'analyse." },
    { key: "entrevues", label: "Entrevues filmées", done: input.interviewsFilmed, target: input.interviewsPerWeek, help: `Rythme pour atteindre ${INTERVIEW_GOAL} filles d'ici la fin de la saison.` }
  ];
}

const DAY = 86_400_000;
const parse = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
export const addDaysIso = (iso: string, n: number) => new Date(parse(iso) + n * DAY).toISOString().slice(0, 10);

/** Dimanche de la semaine (les semaines de l'académie vont du dimanche au samedi, comme la paie). */
export function weekStart(iso: string): string {
  const d = new Date(parse(iso));
  return addDaysIso(iso, -d.getUTCDay());
}

/** Combien d'entrevues filmer par semaine pour arriver à l'objectif avant la fin de la saison. */
export function interviewsPerWeek(filmed: number, today: string, goal = INTERVIEW_GOAL, end = SEASON_END): number {
  const left = Math.max(0, goal - filmed);
  if (!left) return 0;
  const from = today < INTERVIEWS_START ? INTERVIEWS_START : today;
  const weeks = Math.max(1, Math.ceil((parse(end) - parse(from)) / (7 * DAY)));
  return Math.ceil(left / weeks);
}

/* ── Entrevues ─────────────────────────────────────────────────────── */

export type InterviewStatus = "a_inviter" | "invitee" | "confirmee" | "filmee" | "montee" | "publiee" | "decline";
export const INTERVIEW_STATUS: { id: InterviewStatus; label: string; tone: "info" | "warn" | "good" | "bad" }[] = [
  { id: "a_inviter", label: "À inviter", tone: "info" },
  { id: "invitee", label: "Invitée, pas encore d'heure", tone: "warn" },
  { id: "confirmee", label: "Heure choisie", tone: "good" },
  { id: "filmee", label: "Filmée", tone: "good" },
  { id: "montee", label: "Montée", tone: "good" },
  { id: "publiee", label: "Publiée", tone: "good" },
  { id: "decline", label: "Ne vient pas", tone: "bad" }
];
export const interviewStatusLabel = (s: string) => INTERVIEW_STATUS.find((x) => x.id === s)?.label ?? s;
export const FILMED_STATUSES: InterviewStatus[] = ["filmee", "montee", "publiee"];

export interface InterviewSlot {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  place: string;
  capacity: number;
  note: string | null;
}

/** Places restantes d'une journée d'entrevues (les entrevues déclinées ne prennent pas de place). */
export function slotRemaining(slot: InterviewSlot, interviews: { slot_id: string | null; status: string }[]): number {
  const taken = interviews.filter((i) => i.slot_id === slot.id && i.status !== "decline").length;
  return Math.max(0, slot.capacity - taken);
}

/** Les questions d'entrevue : tirées des sondages aux familles (plaisir, progrès, confiance, ce qu'on fait de mieux)
 *  et des questions que les parents posent avant de s'inscrire. Courtes, une idée à la fois, réponse en phrase complète. */
export const INTERVIEW_GUIDE: { who: string; when: string; questions: string[] }[] = [
  {
    who: "Joueuse",
    when: "Début de saison",
    questions: [
      "Présente-toi : ton prénom, ton âge, ton équipe.",
      "Depuis quand tu joues au soccer ? Pourquoi tu as choisi New Valkyria ?",
      "Qu'est-ce que tu aimes le plus quand tu joues ?",
      "Sur 10, ta confiance avec le ballon aujourd'hui ?",
      "Un geste que tu veux réussir d'ici la fin de la saison ?",
      "Montre-nous ton geste préféré avec le ballon (10 secondes)."
    ]
  },
  {
    who: "Joueuse",
    when: "Fin de saison",
    questions: [
      "Qu'est-ce que tu as appris cette saison ?",
      "Le geste que tu voulais réussir : montre-le-nous.",
      "Sur 10, ta confiance avec le ballon maintenant ?",
      "Ton meilleur moment de la saison ?",
      "Que dirais-tu à une fille qui hésite à venir ?"
    ]
  },
  {
    who: "Parent",
    when: "Début ou fin de saison",
    questions: [
      "Pourquoi avez-vous choisi New Valkyria ?",
      "Qu'est-ce qui a changé chez votre fille (le ballon, la confiance, la créativité) ?",
      "Votre fille a-t-elle du plaisir ? À quoi le voyez-vous à la maison ?",
      "Qu'est-ce qu'on fait de mieux que les autres ?",
      "Que diriez-vous à une famille qui hésite (horaire, encadrement, prix) ?"
    ]
  }
];

/** Jours de match : chaque joueuse en photo (fiches, bulletins, publications, souvenirs pour les familles). */
export const MATCH_PHOTOS = [
  "Avant le match : une photo portrait de chaque joueuse en chandail New Valkyria, fond propre (même cadrage pour toutes).",
  "Une photo d'équipe complète avec les coachs.",
  "Pendant le match : au moins une photo de chaque fille en action (ballon au pied, duel, célébration).",
  "Après : le moment fort (victoire, but, câlin d'équipe) et les filles avec leurs parents si elles le veulent.",
  "Le soir même : trier, garder les meilleures, nommer « AAAA-MM-JJ Équipe photos match » et coller le lien du dossier dans le suivi.",
  "Les portraits servent aux fiches des joueuses (robot MonClubSportif), aux bulletins et aux publications ; les photos d'action, aux réseaux."
];

export const INTERVIEW_SETUP = [
  "Un coin calme, un fond propre (bannière ou mur New Valkyria), la lumière devant la personne.",
  "Téléphone ou caméra à hauteur des yeux, sur trépied, micro-cravate branché et testé.",
  "La joueuse ou le parent regarde la personne qui pose les questions, pas la caméra.",
  "Demander de reprendre la question dans la réponse (« Ce qui a changé chez ma fille, c'est… »).",
  "5 minutes par joueuse, 5 de plus si un parent est filmé ; nommer le fichier « AAAA-MM-JJ Prénom Nom début ».",
  "Monter chaque entrevue en 3 formats : reel de 30 secondes, version longue, citation en image (P3.2.09)."
];

/* ── Ball mastery à 360° ───────────────────────────────────────────── */

export const BALL_MASTERY_360 = {
  gear: ["Caméra 360° chargée, carte mémoire vide", "Trépied solide (celui de la Veo ou un trépied lesté), sac de sable", "Une pastille par joueuse", "Le téléphone pour lancer et vérifier l'enregistrement"],
  steps: [
    "Avant l'arrivée des filles : trépied au centre de la zone de ball mastery, lesté, déplié au complet.",
    "Caméra 360° vissée au sommet, à hauteur de hanche d'une fille environ (assez haut pour voir les pieds et le ballon de toutes).",
    "Pastilles en arc de cercle autour du trépied, à 3 ou 4 mètres, une par joueuse, toutes face à la caméra et assez espacées pour ne pas se cacher.",
    "Lancer l'enregistrement avant le premier exercice et dire à voix haute la date et le groupe (repère au montage).",
    "Filmer tout le bloc de ball mastery sans arrêter ; personne ne touche au trépied.",
    "Après la pratique : arrêter, renommer le fichier « AAAA-MM-JJ Groupe ball mastery 360 », le téléverser et coller le lien dans le suivi ci-dessous.",
    "Chaque mois : la même joueuse, le même geste, mois après mois. C'est la preuve de progrès (avant/après, P3.2.17) et le suivi technique des coachs."
  ],
  veo: [
    "La caméra Veo filme l'ensemble de la pratique, sur son mât, en hauteur, du côté du terrain : vue tactique pour l'analyse.",
    "La personne caméra installe la Veo et la 360° ; les coachs ne s'occupent que du coaching.",
    "Les vidéos Veo arrivent toutes seules dans Matchs et pratiques filmés (titres « Newval… »)."
  ]
};

/* ── Calendrier de publication ─────────────────────────────────────── */

export interface CalendarItem {
  date: string;
  kind: "prevu" | "publie";
  title: string;
  postKind: string;
  angle: string | null;
  networks: string[];
  status?: string;
  views?: number | null;
}

/** Les jours de la semaine (dimanche au samedi) avec ce qui est prévu et ce qui est publié. */
export function calendarWeeks(items: CalendarItem[], from: string, weeks: number): { start: string; days: { date: string; items: CalendarItem[] }[] }[] {
  const out = [];
  let start = weekStart(from);
  for (let w = 0; w < weeks; w++) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDaysIso(start, i);
      return { date, items: items.filter((it) => it.date === date) };
    });
    out.push({ start, days });
    start = addDaysIso(start, 7);
  }
  return out;
}

/* ── Branchement des réseaux ───────────────────────────────────────── */

export const NETWORK_LINKS: { network: string; how: string; needs: string }[] = [
  { network: "Instagram", how: "API Graph de Meta (compte professionnel relié à la page Facebook) : vues, portée, abonnés par publication.", needs: "Compte Instagram professionnel, application Meta pour développeurs, jeton longue durée." },
  { network: "Facebook", how: "Même application Meta : portée et vues de la page et de chaque publication, publicités (Ads Manager).", needs: "Rôle administrateur de la page New Valkyria." },
  { network: "YouTube", how: "API YouTube Data : vues, durée de visionnement et abonnés de chaque vidéo.", needs: "Compte Google de la chaîne, clé d'API YouTube." },
  { network: "TikTok", how: "API TikTok for Business (plus tard, si on y publie).", needs: "Compte TikTok professionnel." }
];

/** Tâches du Mandalart qui touchent le contenu, affichées dans l'espace. */
export const CONTENT_TASK_CODES = [
  "P3.2.01", "P3.2.02", "P3.2.03", "P3.2.05", "P3.2.06", "P3.2.07", "P3.2.08", "P3.2.09", "P3.2.10", "P3.2.12", "P3.2.13", "P3.2.14", "P3.2.16", "P3.2.17",
  "P3.2.18", "P3.2.19", "P3.2.20", "P3.2.21", "P8.1.02", "P8.1.03", "P8.1.04", "P4.3.01"
];

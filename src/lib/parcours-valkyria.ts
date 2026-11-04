/** Le parcours Valkyria (demande de JP, 3 nov. 2026) : qui sont nos clientes, ce que la famille vit et reçoit, ce que la
 *  joueuse en tire, le cycle de travail du coach et le lien entre le coaching et la famille. Contenu à plat, sans base
 *  de données : chaque élément dit s'il est EN PLACE dans le site, EN COURS, ou PRÉVU (avec la tâche du Mandalart).
 *  À tenir à jour quand une pièce est construite. */

export type ItemStatus = "en-place" | "en-cours" | "prevu";

export interface ParcoursItem {
  text: string;
  status: ItemStatus;
  /** Où le voir dans le site, ou la tâche du Mandalart qui le prévoit. */
  where?: string;
}

export interface ParcoursStep {
  title: string;
  when?: string;
  items: ParcoursItem[];
}

export const STATUS_LABEL: Record<ItemStatus, string> = { "en-place": "En place", "en-cours": "En cours", prevu: "Prévu" };

/** Qui sont nos clientes. */
export const PROFIL: { title: string; text: string }[] = [
  { title: "Les joueuses", text: "Des filles de 6 à 14 ans, de la débutante à la D1, en 5 groupes d'âge (2017-2018, 2016, 2015, 2014-2013, 2013-2012), en gymnase l'automne et l'hiver, sur synthétique les fins de semaine." },
  { title: "Les familles", text: "Des parents des Laurentides (Sainte-Thérèse, Prévost, Rosemère, Blainville, Terrebonne) qui veulent plus qu'un club : une vraie progression technique, de la confiance et un groupe où leur fille se sent à sa place." },
  { title: "Les programmes", text: "New Valkyria (l'essentiel technique), Team Valkyria (technique, pratiques d'équipe, activités et matchs), Solo Valkyria (avec séances individuelles), groupes avancés sur invitation, Privilège Valkyria, demi-saison. Programmes privés pour les garçons." },
  { title: "La saison", text: "De septembre à avril, fermé pendant les Fêtes. Été : ligue et camps. Une bourse peut réduire le prix de moitié, et le paiement peut se faire en versements." }
];

/** Le parcours de la famille, du premier contact à la réinscription. */
export const PARCOURS_FAMILLE: ParcoursStep[] = [
  {
    title: "1. Découverte",
    when: "Avant l'essai",
    items: [
      { text: "Site newvalkyria.com : programmes, horaires et places restantes par groupe", status: "en-place", where: "/inscription" },
      { text: "Source d'acquisition demandée à l'inscription (comment nous avez-vous connus ?)", status: "en-cours", where: "AU05" },
      { text: "Un seul lien d'entrée : l'évaluation, pour tous les canaux", status: "prevu", where: "P2.2.03" }
    ]
  },
  {
    title: "2. Essai gratuit",
    when: "1 pratique",
    items: [
      { text: "Confirmation de l'essai par courriel (date, heure, lieu, quoi apporter)", status: "en-place" },
      { text: "L'éducateur voit l'essai dans son briefing de 5 minutes : « bien l'accueillir »", status: "en-place", where: "Portail · Avant" },
      { text: "Après l'essai : lien de paiement (complet, par mois, bourse si accordée)", status: "en-place", where: "skill paiement" }
    ]
  },
  {
    title: "3. Inscription et accueil",
    when: "Semaine 1",
    items: [
      { text: "Paiement en ligne, en une fois ou en versements prélevés automatiquement", status: "en-place" },
      { text: "Photo de la joueuse déposée par la famille, avec l'accord de publication à part", status: "en-place", where: "/photo/[lien]" },
      { text: "Compte parent : profils des enfants, calendrier, présences, évaluations, bulletin, points", status: "en-place", where: "/compte" },
      { text: "Courriel de bienvenue avec une vidéo de JP de 60 secondes", status: "prevu", where: "P4.1.01" },
      { text: "Fiche joueuse (joueuse préférée, geste favori, objectifs) lue par la coach avant la 1re séance", status: "prevu", where: "P4.1.03, P4.4.01" },
      { text: "Clip « voici où elle part » de la semaine 1 envoyé au parent", status: "prevu", where: "P4.2.01" }
    ]
  },
  {
    title: "4. La saison",
    when: "Chaque semaine",
    items: [
      { text: "Pratiques préparées 2 semaines d'avance, même thème que le plan de l'année", status: "en-place", where: "Coaching · Pratiques" },
      { text: "Sondage de fin : plaisir et fatigue sur 10, ce qu'elle aimerait avoir plus", status: "en-place", where: "Coaching · Sondage de fin" },
      { text: "Points et niveaux comme dans un jeu, visibles par la famille", status: "en-place", where: "/compte" },
      { text: "Test du mois filmé, comparé à son jour 1 (passeport bronze, argent, or, mauve)", status: "en-cours", where: "Coaching · Tests et passeport" },
      { text: "Bulletin de suivi (sans les notes internes des éducateurs)", status: "en-place", where: "/compte/bulletin" },
      { text: "Message hebdomadaire aux parents : thème, photo, défi maison", status: "prevu", where: "P4.5.01, AU13" },
      { text: "Réponse à toute question en moins de 24 h (agent administratif)", status: "prevu", where: "P4.5.02, A01" },
      { text: "Voix des familles : sondages aux parents", status: "en-place", where: "/admin/sondages" }
    ]
  },
  {
    title: "5. Fin de saison et suite",
    when: "Avril",
    items: [
      { text: "Bilan de la saison, passeport et écussons", status: "prevu", where: "P4.3.02" },
      { text: "Réinscription et été (ligue, camps) proposés d'avance", status: "prevu", where: "P2.4.05, P5.2.10" },
      { text: "Valkyria Lab : la routine maison du mois et « Envoyer ma vidéo »", status: "en-cours", where: "P1.7.02" }
    ]
  }
];

/** Ce que la joueuse en tire. */
export const JOUEUSE: { title: string; text: string }[] = [
  { title: "Technique", text: "Beaucoup de touches (un ballon par fille, aucune file), les gestes du passeport de son niveau, le thème de la semaine vu sous pression et dans le jeu." },
  { title: "Intelligence de jeu", text: "Des formes jouées avec prises de décision à chaque séance, des dossards de couleurs pour regarder avant de recevoir, les clous du thème toujours avec les mêmes mots." },
  { title: "Confiance", text: "Elle est comparée à elle-même (son jour 1, son mois précédent), jamais aux autres ; l'erreur fait partie de l'apprentissage ; un compliment précis à chaque séance." },
  { title: "Appartenance", text: "Le cri Valkyria, les gagnantes du jour, ses points et ses niveaux (de Recrue à Légende), des récompenses, des amies dans son groupe." },
  { title: "Plaisir", text: "Elle donne sa note de plaisir à chaque pratique ; ce qu'elle demande (matchs, tirs, jeux…) revient dans les pratiques suivantes." },
  { title: "Prévention", text: "Échauffement FIFA 11+ Kids intégré au jeu d'entrée ; la fatigue est suivie à chaque séance." }
];

/** Le cycle de travail du coach. */
export const CYCLE_COACH: ParcoursStep[] = [
  {
    title: "Deux semaines avant",
    items: [
      { text: "La pratique est prête : thème du bloc (planification PSG), exercices de la banque, 4 blocs de la structure Valkyria", status: "en-place", where: "Coaching · Pratiques (vert, jaune, rouge)" },
      { text: "Les composantes obligatoires de JP sont dans chaque pratique", status: "en-place", where: "Coaching · Méthode" },
      { text: "Exercices proposés selon le thème de la semaine et le lieu", status: "prevu", where: "P1.3.17" }
    ]
  },
  {
    title: "Avant la pratique",
    items: [
      { text: "Briefing de 5 minutes : filles à suivre et pourquoi, objectifs, essais à accueillir, absentes la dernière fois, moment surprise", status: "en-place", where: "Portail · Avant" },
      { text: "La pratique du jour bloc par bloc (montage, matériel, rôles, points clés, variantes) et les diapos", status: "en-place", where: "Portail · Avant" }
    ]
  },
  {
    title: "Pendant",
    items: [
      { text: "Présences en une touche (« toutes présentes »)", status: "en-place", where: "Portail · Pendant" },
      { text: "Les clous du thème, les corrections en arrêt flash de 20 secondes, parler moins de 20 % du temps", status: "en-place", where: "Diapos de la pratique" }
    ]
  },
  {
    title: "Après",
    items: [
      { text: "Sondage de fin de chaque fille (plaisir, fatigue, ce qu'elle veut plus)", status: "en-place", where: "Portail · Après" },
      { text: "Évaluation rapide de chaque présente (ball mastery, prestation, attitude, une phrase)", status: "en-place", where: "Portail · Après" },
      { text: "Gagnantes du jour (victoire, attitude) : les points se comptent tout seuls", status: "en-place", where: "Portail · Après" },
      { text: "Note de chaque exercice sur 10 (il devient approuvé ou à changer)", status: "en-place", where: "Portail · Après" },
      { text: "Confirmer sa présence : les heures comptent pour la paie si le rapport est complet (relance à 24 h)", status: "en-place", where: "Portail · Après" }
    ]
  },
  {
    title: "Chaque mois",
    items: [
      { text: "Une séance filmée et notée sur 10, retour de JP avec le focus du mois suivant", status: "en-place", where: "Coaching · Observations" },
      { text: "Test du mois filmé de chaque fille", status: "en-cours", where: "P1.2.05 (saisie dans le portail à venir)" },
      { text: "Réunion technique du mois", status: "prevu", where: "P1.4.04" },
      { text: "Certification interne des coachs", status: "prevu", where: "P1.4.02" }
    ]
  },
  {
    title: "La saison",
    items: [
      { text: "Plan de l'année : blocs de 4 à 6 semaines selon la planification PSG, semaine des tests", status: "en-place", where: "Coaching · Plan de l'année" },
      { text: "Curriculum U8 à U12 écrit", status: "prevu", where: "P1.1.06" }
    ]
  }
];

/** Le lien entre le coaching et la famille : ce que l'un saisit devient ce que l'autre voit. */
export const LIEN: { coach: string; famille: string; jp: string }[] = [
  { coach: "Présence à chaque pratique", famille: "Calendrier et présences dans le compte ; points de présence", jp: "Assiduité, joueuses absentes à rappeler" },
  { coach: "Sondage de fin (plaisir, fatigue, envies)", famille: "Sa fille est écoutée : ses envies reviennent dans les pratiques", jp: "Indicateur « appréciation des joueuses » du Mandalart, ce qu'elles demandent" },
  { coach: "Évaluation rapide et tests du mois", famille: "Bulletin et passeport : progression comparée à elle-même", jp: "Joueuses à suivre (attitude basse, baisse, fatigue)" },
  { coach: "Gagnantes du jour", famille: "Barre de points et niveaux, récompenses", jp: "Gagnantes de la semaine, sans classement" },
  { coach: "Rapport complet et présence confirmée", famille: "—", jp: "Paie juste des éducateurs, rapports manquants dans Aujourd'hui" }
];

/** Qui fait quoi. */
export const STRUCTURE: { role: string; text: string }[] = [
  { role: "JP, directeur", text: "La méthode, le plan de l'année, la validation des exercices, l'observation des coachs, les familles et les partenaires." },
  { role: "Éducatrices et éducateurs", text: "Préparent, animent et font le rapport de leurs pratiques dans le portail ; ne voient que leurs groupes." },
  { role: "Annie Tremblay, responsable administratif", text: "La boîte info@, les inscriptions, les paiements, les courriels aux familles." },
  { role: "Christine Durand, gérante", text: "En copie des annonces aux familles et des partenaires ; accès gérante à l'admin." },
  { role: "Les agents IA", text: "Construits un à un, en mode assistant d'abord : administratif (courriels), MonClubSportif, financier, suivi des familles." }
];

import type { CoachProfile, FAQItem, MethodSection, ProgramOffer, Testimonial } from "@/types/contracts";

export const navItems = [
  { href: "/", label: "Accueil" },
  { href: "/methode", label: "Méthode" },
  { href: "/equipe", label: "L'équipe" },
  { href: "/vision", label: "Vision" },
  { href: "/inscription", label: "Inscription" }
];

export const hero = {
  badge: "Académie locale forte - Laurentides",
  title: "Former des joueuses de soccer plus techniques, plus intelligentes, plus confiantes.",
  description:
    "New Valkyria accompagne les filles de 9 à 14 ans avec une méthodologie intensive: groupes limités, suivi vidéo, cadre exigeant et progression visible dès 6 séances.",
  cta: "Réserver une place"
};

export const painPoints = [
  "Encadrement trop variable d'une séance à l'autre",
  "Exercices peu intenses et peu spécifiques pour les filles",
  "Peu de suivi individuel sur la technique et le QI foot",
  "Parents sans visibilité claire sur la progression"
];

export const methodHighlights = [
  "Méthode centrée neurosciences du sport et apprentissage par le jeu",
  "Séances de 90 minutes en opposition réelle et intensité haute",
  "Analyse vidéo des pratiques pour ajuster rapidement",
  "Routine maison structurée pour accélérer la progression"
];

export const keyResults = [
  "Amélioration technique visible dès les 6 premières séances",
  "Ratio renforcé: 1 coach pour 5 joueuses sur certaines séances",
  "Groupe limité à 10 joueuses pour protéger la qualité",
  "Évaluations formelles à la 7e et à la 15e séance"
];

export const seasonalOffer: ProgramOffer = {
  title: "Programme saison New Valkyria",
  priceLabel: "550 $",
  duration: "15 séances semi-privées (1x/semaine)",
  capacity: "10 joueuses maximum",
  includes: [
    "Routine technique à la maison",
    "Suivi force/faiblesse personnalisé",
    "Mise à jour complète à mi-parcours",
    "Encadrement adapté aux niveaux Intermédiaire à Élite"
  ],
  policy: "Annulation possible sans frais après 6 séances selon politique interne."
};

export const coachProfile: CoachProfile = {
  fullName: "Jean-Paul Aka",
  experienceYears: 6,
  certifications: ["Certification C CONCACAF"],
  mission: "Développer le foot féminin avec un cadre exigeant et motivant.",
  values: ["Discipline", "Détail technique", "Intensité", "Respect du rythme de progression"]
};

export const methodSections: MethodSection[] = [
  {
    title: "Technique",
    description: "Travail précis des fondamentaux avec répétitions sous pression.",
    points: ["Contrôle orienté", "Passe et finition", "Dribble en espace réduit"]
  },
  {
    title: "Mental",
    description: "Renforcer confiance, concentration et prise d'information.",
    points: ["Lecture du jeu", "Prise de décision rapide", "Gestion des erreurs"]
  },
  {
    title: "Physique",
    description: "Intensité progressive adaptée aux profils féminins jeunes.",
    points: ["Coordination", "Explosivité", "Habitudes d'entraînement durables"]
  }
];

export const testimonials: Testimonial[] = [
  {
    id: "t-1",
    name: "Natasha Gosselin",
    role: "Mère d'une joueuse (gardienne)",
    quote: "J'ai remarqué une belle progression, particulièrement au niveau du jeu de pied. Les entraînements sont toujours structurés, motivants et adaptés.",
    status: "verified"
  },
  {
    id: "t-2",
    name: "Bianca Giroux",
    role: "Mère d'une joueuse",
    quote: "Notre fille a acquis beaucoup de technique sur le ballon. Le coach JP a su lui donner confiance en ses habiletés — elle est devenue plus menaçante pour ses adversaires.",
    status: "verified"
  },
  {
    id: "t-3",
    name: "Benoit Cousineau",
    role: "Père d'une joueuse",
    quote: "Tu fais plus que de former des joueuses de soccer, tu formes des futures femmes. Lâche pas JP.",
    status: "verified"
  }
];

export const faqItems: FAQItem[] = [
  {
    id: "faq-1",
    question: "À qui s'adresse le programme?",
    answer: "Aux joueuses de 9 à 14 ans, niveau intermédiaire à élite, motivées à progresser techniquement."
  },
  {
    id: "faq-2",
    question: "Comment fonctionne la garantie progression?",
    answer: "Nous visons une amélioration notable visible en 6 séances grâce au suivi technique et aux routines maison."
  },
  {
    id: "faq-3",
    question: "Les parents peuvent-ils assister?",
    answer: "Oui, les parents peuvent assister dans le respect du cadre d'entraînement."
  },
  {
    id: "faq-4",
    question: "Où se déroulent les entraînements?",
    answer: "Principalement dans les Laurentides: Rosemère, Mirabel et Saint-Thérèse selon les blocs de saison."
  }
];

export const timeline = [
  {
    step: "S1–S6",
    title: "Changement visible",
    text: "Amélioration du contrôle, de la prise d'information et de la confiance en match."
  },
  {
    step: "S7",
    title: "Évaluation intermédiaire",
    text: "Rapport remis aux parents avec ajustements ciblés pour accélérer la seconde moitié."
  },
  {
    step: "S8–S15",
    title: "Consolidation",
    text: "Intensité maintenue, progression mesurée séance par séance, préparation du prochain cycle."
  },
  {
    step: "S15",
    title: "Bilan final",
    text: "Synthèse complète des acquis et recommandations concrètes pour la continuité sportive."
  }
];

export const locations = ["Rosemère", "Mirabel", "Saint-Thérèse", "Laurentides"];

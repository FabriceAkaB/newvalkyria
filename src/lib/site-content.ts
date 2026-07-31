import type { CoachProfile, FAQItem, MethodSection, ProgramOffer, Testimonial } from "@/types/contracts";

export const navItems = [
  { href: "/", label: "Accueil" },
  { href: "/methode", label: "Méthode" },
  { href: "/equipe", label: "À propos" },
  { href: "/boutique", label: "Boutique" },
  { href: "/inscription", label: "Inscription" },
  { href: "/compte", label: "Connexion" }
];

export const hero = {
  badge: "Académie locale forte - Laurentides",
  title: "Former des joueuses de soccer plus techniques, plus intelligentes, plus confiantes.",
  description:
    "New Valkyria accompagne les filles de 8 à 14 ans avec une méthodologie intensive: groupes limités, suivi vidéo, cadre exigeant et progression visible dès 6 séances.",
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

export const seasonalOffer: ProgramOffer = {
  title: "Forfait pour la saison",
  priceLabel: "550 $",
  duration: "15 séances semi-privées (1x/semaine)",
  capacity: "1 coach pour 6-8 joueuses",
  includes: [
    "Routine technique à la maison",
    "Suivi force/faiblesse personnalisé",
    "Mise à jour complète à mi-parcours",
    "Encadrement adapté aux niveaux Intermédiaire à Élite"
  ],
  policy: "Annulation possible sans frais après 6 séances selon politique interne."
};

export const coachProfile: CoachProfile = {
  fullName: "New Valkyria",
  experienceYears: 6,
  certifications: ["Certification C CONCACAF"],
  mission: "Développer le foot féminin avec un cadre exigeant et motivant.",
  values: ["Discipline", "Détail technique", "Intensité", "Respect du rythme de progression"]
};

export const methodSections: MethodSection[] = [
  {
    title: "Technique",
    description: "Connexion individuelle avec le ballon travaillée intensivement: dribble, contrôle et duels 1 contre 1 répétés sous pression.",
    points: ["Dribble et conduite de balle", "Duels 1 contre 1", "Contrôle orienté sous pression"]
  },
  {
    title: "Mental",
    description: "La confiance et l'estime de soi au coeur de chaque séance — une joueuse qui croit en elle prend de meilleures décisions.",
    points: ["Confiance en soi renforcée", "Estime de soi valorisée", "Lecture du jeu et prise de décision"]
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
    quote: "Notre fille a acquis beaucoup de technique sur le ballon. L'équipe a su lui donner confiance en ses habiletés — elle est devenue plus menaçante pour ses adversaires.",
    status: "verified"
  },
  {
    id: "t-3",
    name: "Benoit Cousineau",
    role: "Père d'une joueuse",
    quote: "Vous faites plus que former des joueuses de soccer, vous formez des futures femmes. Continuez comme ça.",
    status: "verified"
  }
];

export const faqItems: FAQItem[] = [
  {
    id: "faq-1",
    question: "À qui s'adresse le programme?",
    answer: "Aux joueuses de 8 à 14 ans, niveau intermédiaire à élite, motivées à progresser techniquement."
  },
  {
    id: "faq-2",
    question: "Comment fonctionne la garantie progression?",
    answer: "Si vous n'êtes pas satisfait de la progression de votre joueuse cette saison, vous êtes remboursé à 100 % — sans justification à fournir."
  },
  {
    id: "faq-3",
    question: "Les parents peuvent-ils assister?",
    answer: "Oui, les parents peuvent assister dans le respect du cadre d'entraînement."
  },
  {
    id: "faq-4",
    question: "Où se déroulent les entraînements?",
    answer: "Dans les Laurentides: Terrebonne, Sainte-Thérèse, Saint-Jérôme et Rosemère selon les blocs de saison."
  }
];

export const locations = ["Terrebonne", "Sainte-Thérèse", "Saint-Jérôme", "Rosemère"];

/* ════════════════════════════════════════════════════════════════
   Saison Automne–Hiver 2027 — Source de données unique
   ----------------------------------------------------------------
   Toute la logique publique du tunnel d'inscription lit ce fichier :
   catégories, programmes, plages horaires, capacités, taxes.
   L'administration (Phase 2) viendra piloter ces valeurs ; d'ici là
   elles sont éditables ici, à un seul endroit.
   ════════════════════════════════════════════════════════════════ */

export type BirthYear = "2017" | "2016" | "2015" | "2014-2013";

export const BIRTH_YEARS: BirthYear[] = ["2017", "2016", "2015", "2014-2013"];

export const BIRTH_YEAR_LABELS: Record<BirthYear, string> = {
  "2017": "2017",
  "2016": "2016",
  "2015": "2015",
  "2014-2013": "2014–2013"
};

/** Années admissibles selon la section.
 *  Les groupes avancés (AV) ne comptent que des joueuses nées en 2015 et 2016. */
export function getBirthYearsFor(variant: "public" | "advanced"): BirthYear[] {
  if (variant === "advanced") return ["2016", "2015"];
  return BIRTH_YEARS;
}

/** Détecte automatiquement la catégorie (année de naissance) à partir d'une
 *  date de naissance — utilisé pour pré-remplir le tunnel depuis un profil
 *  enfant enregistré. Les naissances 2014 et avant tombent dans le groupe le
 *  plus âgé disponible (2014–2013), faute de catégorie plus ancienne. */
export function birthYearFromDob(dob: string): BirthYear | null {
  const year = new Date(dob).getFullYear();
  if (Number.isNaN(year)) return null;
  if (year >= 2015 && year <= 2017) return String(year) as BirthYear;
  if (year <= 2014) return "2014-2013";
  return null;
}

/* ── Programmes ─────────────────────────────────────────────── */

export type ProgramCode = "TV" | "SV" | "NV" | "TVA" | "SVA";

export interface ProgramDef {
  code: ProgramCode;
  name: string;
  /** Prix avant taxes, en dollars. */
  price: number;
  priceLabel: string;
  /** true = jamais affiché publiquement (accès par code d'invitation). */
  invitation: boolean;
  tagline: string;
  includes: string[];
  tech: string;
  team: string;
  solo: string;
  /** Ordre d'affichage — plus petit = affiché en premier. TV prioritaire. */
  order: number;
  /** Catégories admissibles à ce programme. */
  eligibleYears: BirthYear[];
  /** Badge de mise en avant (ex. "🔥 Le plus populaire"). */
  badge?: string;
  /** Aperçu des pratiques d'équipe incluses (fréquence + horaire prévu). */
  teamPractice?: SessionPreview;
  /** Aperçu des séances individuelles incluses. */
  soloSession?: SessionPreview;
}

export interface SessionPreview {
  count: string;
  schedule: string[];
}

const TEAM_PRACTICE: SessionPreview = {
  count: "10 pratiques d'équipe",
  schedule: ["Le dimanche", "De 17 h à 18 h", "Une semaine sur deux"]
};

const SOLO_SESSION: SessionPreview = {
  count: "5 séances individuelles (One-on-One)",
  schedule: ["Le vendredi soir", "Horaire confirmé par l'académie"]
};

const ALL_YEARS = BIRTH_YEARS;

export const PROGRAMS: Record<ProgramCode, ProgramDef> = {
  TV: {
    code: "TV",
    name: "Team Valkyria",
    price: 875.95,
    priceLabel: "875,95 $",
    invitation: false,
    tagline: "L'offre principale — technique, équipe et vie d'académie.",
    includes: [
      "20 pratiques techniques semi-privé",
      "10 pratiques d'équipe (une aux deux semaines)",
      "Environ 30 activités durant la saison",
      "Invitation à des matchs",
      "Accès au programme vidéo maison",
      "Bulletin de suivi des apprentissages"
    ],
    tech: "20",
    team: "10",
    solo: "—",
    order: 1,
    // 2014-2013 : seule l'offre New Valkyria (~653 $) est proposée pour cette catégorie.
    eligibleYears: ALL_YEARS.filter((y) => y !== "2014-2013"),
    badge: "🔥 Le plus populaire",
    teamPractice: TEAM_PRACTICE
  },
  SV: {
    code: "SV",
    name: "Solo Valkyria",
    price: 1454.95,
    priceLabel: "1 454,95 $",
    invitation: false,
    tagline: "Développement accéléré avec séances individuelles.",
    includes: [
      "15 pratiques techniques semi-privé",
      "10 pratiques d'équipe",
      "5 séances individuelles (One-on-One)",
      "Accès au programme vidéo maison",
      "Bulletin de suivi des apprentissages"
    ],
    tech: "15",
    team: "10",
    solo: "5",
    order: 2,
    // 2014-2013 : seule l'offre New Valkyria (~653 $) est proposée pour cette catégorie.
    eligibleYears: ALL_YEARS.filter((y) => y !== "2014-2013"),
    teamPractice: TEAM_PRACTICE,
    soloSession: SOLO_SESSION
  },
  NV: {
    code: "NV",
    name: "New Valkyria",
    price: 653.45,
    priceLabel: "653,45 $",
    invitation: false,
    tagline: "L'essentiel technique pour progresser.",
    includes: [
      "20 pratiques techniques semi-privé",
      "Accès au programme vidéo maison",
      "Bulletin de suivi des apprentissages"
    ],
    tech: "20",
    team: "—",
    solo: "—",
    order: 3,
    eligibleYears: ALL_YEARS
  },
  TVA: {
    code: "TVA",
    name: "Team Valkyria Avancé",
    price: 875.95,
    priceLabel: "875,95 $",
    invitation: true,
    tagline: "Sur invitation — groupe avancé.",
    includes: [
      "20 pratiques techniques semi-privé",
      "10 pratiques d'équipe (une aux deux semaines)",
      "Environ 30 activités durant la saison",
      "Accès au programme vidéo maison",
      "Bulletin de suivi des apprentissages"
    ],
    tech: "20",
    team: "10",
    solo: "—",
    order: 1,
    eligibleYears: ALL_YEARS,
    badge: "🔥 Le plus populaire",
    teamPractice: TEAM_PRACTICE
  },
  SVA: {
    code: "SVA",
    name: "Solo Valkyria Avancé",
    price: 1454.95,
    priceLabel: "1 454,95 $",
    invitation: true,
    tagline: "Sur invitation — groupe avancé, séances individuelles.",
    includes: [
      "15 pratiques techniques semi-privé",
      "10 pratiques d'équipe",
      "5 séances individuelles (One-on-One)",
      "Accès au programme vidéo maison",
      "Bulletin de suivi des apprentissages"
    ],
    tech: "15",
    team: "10",
    solo: "5",
    order: 2,
    eligibleYears: ALL_YEARS,
    teamPractice: TEAM_PRACTICE,
    soloSession: SOLO_SESSION
  }
};

/* ── Capacité par (programme × catégorie) ───────────────────────
   `taken` = places déjà confirmées ; `max` = capacité.
   L'admin ajustera ces valeurs ; ajouter des places rouvre
   automatiquement le programme (isFull recalculé). */

interface Capacity {
  max: number;
  taken: number;
}

const capacityByProgramYear: Record<string, Capacity> = {
  // Public — valeurs de départ (éditables)
  "TV:2017": { max: 16, taken: 4 },
  "TV:2016": { max: 24, taken: 18 },
  "TV:2015": { max: 24, taken: 24 }, // complet (démo)
  "TV:2014-2013": { max: 16, taken: 6 },

  "SV:2017": { max: 8, taken: 2 },
  "SV:2016": { max: 8, taken: 5 },
  "SV:2015": { max: 8, taken: 7 },
  "SV:2014-2013": { max: 8, taken: 3 },

  "NV:2017": { max: 16, taken: 6 },
  "NV:2016": { max: 24, taken: 12 },
  "NV:2015": { max: 24, taken: 20 },
  "NV:2014-2013": { max: 16, taken: 8 },

  // Avancé (accès invitation)
  "TVA:2016": { max: 12, taken: 8 },
  "TVA:2015": { max: 12, taken: 9 },
  "SVA:2016": { max: 4, taken: 2 },
  "SVA:2015": { max: 4, taken: 3 }
};

export interface Availability {
  max: number;
  taken: number;
  remaining: number;
  isFull: boolean;
}

/** Places réellement occupées, calculées côté serveur à partir des vraies
 *  inscriptions en base (voir /api/inscription/disponibilites). Quand elles
 *  ne sont pas encore chargées, les fonctions ci-dessous retombent
 *  brièvement sur les chiffres de démonstration statiques ci-dessus. */
export interface LiveAvailability {
  programCategory: Record<string, { max: number; taken: number }>;
  slots: Record<string, { max: number; taken: number }>;
}

export function getProgramAvailability(code: ProgramCode, year: BirthYear, live?: LiveAvailability): Availability {
  const key = `${code}:${year}`;
  const cap = live?.programCategory[key] ?? capacityByProgramYear[key] ?? { max: 0, taken: 0 };
  const remaining = Math.max(0, cap.max - cap.taken);
  return { max: cap.max, taken: cap.taken, remaining, isFull: remaining <= 0 };
}

/** Programmes visibles pour une catégorie, dans l'ordre de priorité.
 *  variant "public" → TV, SV, NV. variant "advanced" → TVA, SVA.
 *  Le programme New Valkyria (653,45 $) est disponible pour toutes les
 *  catégories ; sa capacité limitée pour 2015/2016 (3 places) est gérée par
 *  le système de capacité standard (admin → Capacité), pas par ce filtre. */
export function getProgramsForYear(
  year: BirthYear,
  variant: "public" | "advanced",
  live?: LiveAvailability
): ProgramDef[] {
  return Object.values(PROGRAMS)
    .filter((p) => (variant === "advanced" ? p.invitation : !p.invitation))
    .filter((p) => p.eligibleYears.includes(year))
    .filter((p) => (live?.programCategory[`${p.code}:${year}`] ?? capacityByProgramYear[`${p.code}:${year}`]) !== undefined)
    .sort((a, b) => a.order - b.order);
}

/* ── Plages horaires ────────────────────────────────────────────
   Le public ne voit jamais la structure interne (U10, avancé…).
   Il voit : jour, heure, lieu, places restantes, et l'étoile
   « recommandé » le cas échéant. */

export interface SlotDef {
  id: string;
  day: string;
  time: string;
  location: string;
  max: number;
  taken: number;
  /** Recommandé pour les joueuses avancées (⭐), sans blocage. */
  recommendedForAdvanced?: boolean;
  /** Programmes desservis par cette plage. */
  programs: ProgramCode[];
  /** Catégories concernées. */
  years: BirthYear[];
}

const SLOTS: SlotDef[] = [
  // Lundi — Sainte-Thérèse
  { id: "lun-1", day: "Lundi", time: "18 h 00 – 19 h 25", location: "Sainte-Thérèse", max: 8, taken: 5, recommendedForAdvanced: true, programs: ["TVA", "SVA"], years: ["2016"] },
  { id: "lun-2", day: "Lundi", time: "18 h 00 – 19 h 25", location: "Sainte-Thérèse", max: 8, taken: 3, programs: ["TV", "SV", "NV"], years: ["2017"] },
  { id: "lun-3", day: "Lundi", time: "19 h 30 – 20 h 55", location: "Sainte-Thérèse", max: 8, taken: 6, programs: ["TV", "SV", "NV", "TVA", "SVA"], years: ["2015"] },
  { id: "lun-4", day: "Lundi", time: "19 h 30 – 20 h 55", location: "Sainte-Thérèse", max: 8, taken: 2, programs: ["TV", "SV", "NV"], years: ["2014-2013"] },

  // Mercredi — Sainte-Thérèse (avancé U11 prioritaire)
  { id: "mer-1", day: "Mercredi", time: "19 h 30 – 20 h 55", location: "Sainte-Thérèse", max: 14, taken: 8, recommendedForAdvanced: true, programs: ["TVA", "SVA"], years: ["2015"] },
  { id: "mer-2", day: "Mercredi", time: "19 h 30 – 20 h 55", location: "Sainte-Thérèse", max: 2, taken: 2, programs: ["TV", "SV", "NV"], years: ["2015"] },
  { id: "mer-3", day: "Mercredi", time: "18 h 00 – 19 h 25", location: "Sainte-Thérèse", max: 8, taken: 0, programs: ["TV", "SV", "NV"], years: ["2016"] },
  { id: "mer-4", day: "Mercredi", time: "18 h 00 – 19 h 25", location: "Sainte-Thérèse", max: 8, taken: 0, programs: ["TV", "SV", "NV"], years: ["2017"] },

  // Jeudi — Saint-Jérôme
  { id: "jeu-1", day: "Jeudi", time: "18 h 00 – 19 h 25", location: "Saint-Jérôme", max: 8, taken: 4, programs: ["TV", "SV", "NV", "TVA", "SVA"], years: ["2016"] },
  { id: "jeu-2", day: "Jeudi", time: "18 h 00 – 19 h 25", location: "Saint-Jérôme", max: 8, taken: 3, programs: ["TV", "SV", "NV"], years: ["2017"] },
  { id: "jeu-3", day: "Jeudi", time: "19 h 30 – 20 h 55", location: "Saint-Jérôme", max: 8, taken: 5, programs: ["TV", "SV", "NV", "TVA", "SVA"], years: ["2015"] },
  { id: "jeu-4", day: "Jeudi", time: "19 h 30 – 20 h 55", location: "Saint-Jérôme", max: 8, taken: 4, programs: ["TV", "SV", "NV"], years: ["2014-2013"] }

  // Vendredi — plus de pratique technique de groupe : les plages sont dédiées
  // aux séances individuelles (solo) des programmes SV/SVA (voir solo_groups en base).
];

export interface SlotView {
  id: string;
  day: string;
  time: string;
  location: string;
  remaining: number;
  isFull: boolean;
  recommended: boolean;
}

/** Plages compatibles avec un programme + une catégorie.
 *  variant "public"  → uniquement les plages régulières (jamais les plages
 *                       réservées aux groupes avancés).
 *  variant "advanced" → toutes les plages de la catégorie, y compris les
 *                       plages avancées ⭐ ET les plages régulières (flexibilité). */
export function getSlotsFor(
  code: ProgramCode,
  year: BirthYear,
  variant: "public" | "advanced" = "public",
  live?: LiveAvailability
): SlotView[] {
  return SLOTS
    .filter((s) => s.years.includes(year))
    .filter((s) => {
      // Section avancée : toutes les plages de la catégorie (flexibilité)
      if (variant === "advanced") return true;
      // Public : la plage doit servir ce programme et ne jamais être réservée à l'avancé
      return s.programs.includes(code) && !s.recommendedForAdvanced;
    })
    .map((s) => {
      const cap = live?.slots[s.id] ?? { max: s.max, taken: s.taken };
      const remaining = Math.max(0, cap.max - cap.taken);
      return {
        id: s.id,
        day: s.day,
        time: s.time,
        location: s.location,
        remaining,
        isFull: remaining <= 0,
        recommended: Boolean(s.recommendedForAdvanced)
      };
    });
}

export function findSlot(id: string): SlotDef | undefined {
  return SLOTS.find((s) => s.id === id);
}

/* ── Taxes (Québec) ─────────────────────────────────────────── */

export const TAX_RATES = {
  tps: 0.05,      // TPS / GST
  tvq: 0.09975    // TVQ / QST
};

export interface PriceBreakdown {
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
}

export function computePrice(price: number): PriceBreakdown {
  const tps = price * TAX_RATES.tps;
  const tvq = price * TAX_RATES.tvq;
  return {
    subtotal: price,
    tps,
    tvq,
    total: price + tps + tvq
  };
}

export function formatCAD(amount: number): string {
  return amount.toLocaleString("fr-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

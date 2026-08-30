import { z } from "zod";

import { isValidPhone } from "@/lib/form-validation";

export const leadFormSchema = z.object({
  parent_name: z.string().min(2, "Nom du parent requis"),
  email: z.string().email("Courriel invalide"),
  phone: z.string().min(8, "Téléphone invalide"),
  player_age: z.string().min(1, "Âge requis"),
  player_level: z.enum(["Débutante", "Intermédiaire", "Élite", "D1", "D2", "D3"]),
  city: z.string().min(2, "Ville requise"),
  goal: z.string().min(2, "Objectif requis"),
  availability: z.string().min(3, "Disponibilités requises"),
  consent: z.boolean().refine((value) => value, {
    message: "Le consentement est obligatoire"
  }),
  player_name: z.string().optional(),
  player_position: z.string().optional(),
  player_club: z.string().optional(),
  time_slot: z.string().optional()
});

export const checkoutSchema = z.object({
  leadId: z.string().uuid("Identifiant de lead invalide"),
  email: z.string().email("Courriel invalide"),
  addons: z.array(z.enum(["tir", "dribble", "analyse"])).optional(),
  category: z.enum(["2016", "2015", "2014-2013"]).optional(),
  checkoutType: z.enum(["elite", "trial", "half-season"]).optional(),
  trialYear: z.enum(["2016", "2015", "2014-2013"]).optional(),
  cancelPath: z.string().refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "Chemin d'annulation invalide"
  }).optional(),
  parentName: z.string().optional(),
  childName: z.string().optional(),
  timeSlot: z.string().optional()
}).superRefine((payload, ctx) => {
  if (payload.checkoutType === "trial" && !payload.trialYear) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "L'année d'essai est requise",
      path: ["trialYear"]
    });
  }
});

export type LeadFormPayload = z.infer<typeof leadFormSchema>;
export type CheckoutPayload = z.infer<typeof checkoutSchema>;

/* ── Tunnel Automne/Hiver 2027 (saison en base de données) ────────── */

const seasonPlayerFieldsSchema = {
  parentName: z.string().min(2, "Nom du responsable requis"),
  parentEmail: z.string().email("Courriel invalide"),
  parentPhone: z.string().refine(isValidPhone, "Numéro de téléphone invalide (10 chiffres)"),
  city: z.string().min(2, "Ville requise"),
  playerFirstName: z.string().min(1, "Prénom de la joueuse requis"),
  playerLastName: z.string().min(1, "Nom de la joueuse requis"),
  playerDob: z.string().min(4).optional()
};

export const seasonTrialSchema = z.object(seasonPlayerFieldsSchema);

export const seasonCheckoutSchema = z.object({
  ...seasonPlayerFieldsSchema,
  programCode: z.enum(["TV", "SV", "NV", "TVA", "SVA", "TVD"]),
  year: z.enum(["2017", "2016", "2015", "2014-2013"]),
  slotId: z.string().optional(),
  variant: z.enum(["public", "advanced"]),
  includeBag: z.boolean().optional(),
  paymentPlan: z.enum(["full", "installments"]).optional(),
  uniformBundle: z.object({
    jerseyVariantId: z.string(),
    shortVariantId: z.string()
  }).optional(),
  cancelPath: z.string().refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "Chemin d'annulation invalide"
  }).optional()
});

export const seasonWaitlistSchema = z.object({
  ...seasonPlayerFieldsSchema,
  programCode: z.enum(["TV", "SV", "NV", "TVA", "SVA", "TVD"]),
  year: z.enum(["2017", "2016", "2015", "2014-2013"]),
  variant: z.enum(["public", "advanced"])
});

export type SeasonTrialPayload = z.infer<typeof seasonTrialSchema>;
export type SeasonCheckoutPayload = z.infer<typeof seasonCheckoutSchema>;
export type SeasonWaitlistPayload = z.infer<typeof seasonWaitlistSchema>;

/* ── Espace parent (comptes clients) ───────────────────────────── */

export const parentSignUpSchema = z.object({
  fullName: z.string().min(2, "Nom requis"),
  email: z.string().email("Courriel invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères")
});

export const parentSignInSchema = z.object({
  email: z.string().email("Courriel invalide"),
  password: z.string().min(1, "Mot de passe requis")
});

export const childSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  dob: z.string().min(4, "Date de naissance requise"),
  level: z.string().optional(),
  club: z.string().optional()
});

export type ParentSignUpPayload = z.infer<typeof parentSignUpSchema>;
export type ParentSignInPayload = z.infer<typeof parentSignInSchema>;
export type ChildPayload = z.infer<typeof childSchema>;

/* ── Boutique ──────────────────────────────────────────────────── */

export const productSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative("Prix invalide"),
  inventoryCount: z.number().int().nonnegative("Inventaire invalide").optional()
});

export const variantSchema = z.object({
  label: z.string().min(1, "Étiquette requise"),
  size: z.string().optional(),
  color: z.string().optional(),
  sku: z.string().optional(),
  inventoryCount: z.number().int().nonnegative("Inventaire invalide")
});

export const shopCheckoutSchema = z.object({
  customerName: z.string().min(2, "Nom requis"),
  customerEmail: z.string().email("Courriel invalide"),
  customerPhone: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullable(),
        quantity: z.number().int().positive()
      })
    )
    .min(1, "Le panier est vide")
});

export type ProductPayload = z.infer<typeof productSchema>;
export type VariantPayload = z.infer<typeof variantSchema>;
export type ShopCheckoutPayload = z.infer<typeof shopCheckoutSchema>;

/** Programme Sport-Études — indépendant des schémas filles ci-dessus.
 *  Pas de champ paymentPlan : ce programme est payable en un seul
 *  versement uniquement (voir le plan §5). */
export const sportEtudesRegistrationSchema = z.object({
  playerFirstName: z.string().min(1, "Prénom du joueur requis"),
  playerLastName: z.string().min(1, "Nom du joueur requis"),
  playerDob: z.string().optional(),
  playerBirthYear: z.string().optional(),
  playerLevel: z.string().optional(),
  primaryPosition: z.string().optional(),
  secondaryPosition: z.string().optional(),
  currentTeam: z.string().optional(),
  currentClub: z.string().optional(),
  soccerExperience: z.string().optional(),
  playerGoals: z.string().optional(),
  parentAssessedStrengths: z.string().optional(),
  parentAssessedAreasToImprove: z.string().optional(),
  parentFirstName: z.string().min(1, "Prénom du parent requis"),
  parentLastName: z.string().min(1, "Nom du parent requis"),
  parentEmail: z.string().email("Courriel invalide"),
  parentPhone: z.string().refine(isValidPhone, "Numéro de téléphone invalide (10 chiffres)"),
  parentRelationship: z.string().optional(),
  sportEtudesExperience: z.string().optional(),
  priorEvaluationsDone: z.string().optional(),
  targetSportEtudesProgram: z.string().optional(),
  comments: z.string().optional(),
  importantCoachInfo: z.string().optional(),
  termsAccepted: z.boolean().refine((v) => v, { message: "L'acceptation des conditions est obligatoire" }),
  optionChosen: z.enum(["diagnostic_only", "full_program"]),
  paymentPlan: z.enum(["full", "installments"]).optional()
});

export type SportEtudesRegistrationPayload = z.infer<typeof sportEtudesRegistrationSchema>;

export const tryoutEventCreateSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  eventDate: z.string().min(1, "Date requise"),
  startTime: z.string().optional(),
  location: z.string().optional(),
  terrainId: z.string().optional(),
  ageCategory: z.string().optional(),
  organizerNotes: z.string().optional()
});

export const tryoutExternalPlayerSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  dob: z.string().min(1, "Date de naissance requise"),
  primaryPosition: z.string().optional(),
  currentClub: z.string().optional(),
  parentName: z.string().optional(),
  parentEmail: z.string().email("Courriel invalide").optional().or(z.literal("")),
  parentPhone: z.string().optional()
});

export const tryoutEvaluationSaveSchema = z.object({
  evaluatorId: z.string().min(1),
  criteriaScores: z.record(z.string(), z.union([
    z.object({ score: z.number().min(1).max(10) }),
    z.object({ isole: z.number().min(1).max(10), match: z.number().min(1).max(10) })
  ])),
  comment: z.string().optional(),
  commentInternal: z.boolean().optional(),
  completed: z.boolean().optional()
});

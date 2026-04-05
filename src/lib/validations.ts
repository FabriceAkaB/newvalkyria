import { z } from "zod";

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
  player_club: z.string().optional()
});

export const checkoutSchema = z.object({
  leadId: z.string().uuid("Identifiant de lead invalide"),
  email: z.string().email("Courriel invalide"),
  addons: z.array(z.enum(["tir", "dribble", "analyse"])).optional(),
  category: z.enum(["2016", "2015", "2014-2013"]).optional(),
  checkoutType: z.enum(["elite", "trial"]).optional(),
  trialYear: z.enum(["2016", "2015", "2014-2013"]).optional(),
  cancelPath: z.string().refine((value) => value.startsWith("/") && !value.startsWith("//"), {
    message: "Chemin d'annulation invalide"
  }).optional()
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

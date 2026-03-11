import { z } from "zod";

export const leadFormSchema = z.object({
  parent_name: z.string().min(2, "Nom du parent requis"),
  email: z.string().email("Courriel invalide"),
  phone: z.string().min(8, "Téléphone invalide"),
  player_age: z.string().min(1, "Âge requis"),
  player_level: z.enum(["Débutante", "Intermédiaire", "Élite"]),
  city: z.string().min(2, "Ville requise"),
  goal: z.string().min(10, "Objectif trop court"),
  availability: z.string().min(3, "Disponibilités requises"),
  consent: z.boolean().refine((value) => value, {
    message: "Le consentement est obligatoire"
  })
});

export const checkoutSchema = z.object({
  leadId: z.string().uuid("Identifiant de lead invalide"),
  email: z.string().email("Courriel invalide"),
  addons: z.array(z.enum(["tir", "dribble", "analyse"])).optional(),
  category: z.enum(["2016-2017", "2014-2015", "2012-2013"]).optional()
});

export type LeadFormPayload = z.infer<typeof leadFormSchema>;
export type CheckoutPayload = z.infer<typeof checkoutSchema>;

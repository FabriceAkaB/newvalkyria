// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { acquisitionField } from "@/lib/acquisition";
import { privateProgramRegistrationSchema, seasonCheckoutSchema, seasonTrialSchema, seasonWaitlistSchema, sportEtudesRegistrationSchema } from "@/lib/validations";

/** Les routes d'inscription et d'essai étendent leur schéma avec `acquisitionField` (comme ici). Priorité : ne jamais
 *  bloquer une inscription ni un paiement. Un envoi SANS la question (ancien onglet ouvert, lien déjà envoyé) passe ;
 *  un envoi AVEC passe et garde la réponse ; une réponse mal formée est ignorée au lieu de refuser l'inscription. */

const player = {
  parentName: "Marie Tremblay",
  parentEmail: "marie@example.com",
  parentPhone: "514-555-1234",
  city: "Blainville",
  playerFirstName: "Léa",
  playerLastName: "Tremblay"
};

const bases = {
  "inscription saison filles (et Privilège)": {
    schema: seasonCheckoutSchema,
    body: { ...player, programCode: "TV", year: "2016", variant: "public", paymentPlan: "full" }
  },
  "essai filles": { schema: seasonTrialSchema, body: { ...player, trialSlotId: "slot-1" } },
  "liste d'attente filles": { schema: seasonWaitlistSchema, body: { ...player, programCode: "SV", year: "2015", variant: "public" } },
  "programmes garçons privés": {
    schema: privateProgramRegistrationSchema,
    body: {
      programSlug: "garcons-2014",
      playerFirstName: "Noah",
      playerLastName: "Roy",
      birthYear: 2014,
      parentFirstName: "Julie",
      parentLastName: "Roy",
      parentEmail: "julie@example.com",
      parentPhone: "4505551234",
      paymentOption: "full",
      termsAccepted: true
    }
  },
  "Sport-Études": {
    schema: sportEtudesRegistrationSchema,
    body: {
      playerFirstName: "Enzo",
      playerLastName: "Diop",
      parentFirstName: "Awa",
      parentLastName: "Diop",
      parentEmail: "awa@example.com",
      parentPhone: "5145550000",
      termsAccepted: true,
      optionChosen: "diagnostic_only"
    }
  }
} as const;

// Essais garçons (/api/prive/essais) : schéma écrit dans la route, mêmes champs que ceux-ci.
const boysTrialSchema = z.object({
  slug: z.string().min(1),
  dateId: z.string().min(1),
  playerFirstName: z.string().min(1),
  playerLastName: z.string().min(1),
  birthYear: z.number().int(),
  parentName: z.string().min(2),
  parentEmail: z.string().email(),
  parentPhone: z.string(),
  notes: z.string().optional(),
  ...acquisitionField
});

const answer = { source: "parrainage", detail: "ABC123", hasBusiness: true, businessName: "Toitures Roy" };

describe("routes d'inscription et d'essai : question « Comment nous avez-vous connus ? »", () => {
  for (const [name, { schema, body }] of Object.entries(bases)) {
    const extended = (schema as z.ZodObject<z.ZodRawShape>).extend(acquisitionField);

    it(`${name} : accepte un envoi sans la question (compatibilité)`, () => {
      const parsed = extended.parse(body) as Record<string, unknown>;
      expect(parsed.acquisition).toBeUndefined();
      // Le reste du parcours est inchangé : mêmes données que le schéma d'origine.
      expect(parsed).toEqual(schema.parse(body));
    });

    it(`${name} : accepte et garde la réponse du parent`, () => {
      const parsed = extended.parse({ ...body, acquisition: answer }) as Record<string, unknown>;
      expect(parsed.acquisition).toEqual(answer);
    });

    it(`${name} : une réponse mal formée est ignorée, l'inscription passe`, () => {
      for (const bad of ["parrainage", 42, { source: "x".repeat(500) }, { hasBusiness: "oui" }]) {
        const parsed = extended.parse({ ...body, acquisition: bad }) as Record<string, unknown>;
        expect(parsed.acquisition).toBeUndefined();
      }
    });

    it(`${name} : les autres erreurs restent des erreurs`, () => {
      expect(extended.safeParse({ ...body, parentEmail: "pas-un-courriel", acquisition: answer }).success).toBe(false);
    });
  }

  it("essais garçons : sans et avec la question", () => {
    const body = { slug: "garcons-2018", dateId: "d1", playerFirstName: "Noah", playerLastName: "Roy", birthYear: 2018, parentName: "Julie Roy", parentEmail: "julie@example.com", parentPhone: "4505551234" };
    expect(boysTrialSchema.parse(body).acquisition).toBeUndefined();
    expect(boysTrialSchema.parse({ ...body, acquisition: { source: "reseaux", detail: "Instagram", hasBusiness: null } }).acquisition).toEqual({ source: "reseaux", detail: "Instagram", hasBusiness: null });
  });
});

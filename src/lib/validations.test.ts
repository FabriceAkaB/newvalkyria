import { describe, expect, it } from "vitest";

import { checkoutSchema, leadFormSchema } from "@/lib/validations";

describe("leadFormSchema", () => {
  it("accepts a valid lead payload", () => {
    const parsed = leadFormSchema.parse({
      parent_name: "Marie Tremblay",
      email: "marie@example.com",
      phone: "5145558899",
      player_age: "12",
      player_level: "Intermédiaire",
      city: "Mirabel",
      goal: "Améliorer le contrôle et la prise d'information en match.",
      availability: "Lundi et Mercredi",
      consent: true
    });

    expect(parsed.player_level).toBe("Intermédiaire");
  });

  it("rejects when consent is false", () => {
    const result = leadFormSchema.safeParse({
      parent_name: "Jean Dupont",
      email: "jean@example.com",
      phone: "4505557788",
      player_age: "11",
      player_level: "Élite",
      city: "Rosemère",
      goal: "Devenir plus constante techniquement.",
      availability: "Vendredi",
      consent: false
    });

    expect(result.success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  it("requires a valid uuid lead id", () => {
    const result = checkoutSchema.safeParse({
      leadId: "invalid-id",
      email: "parent@example.com"
    });

    expect(result.success).toBe(false);
  });
});

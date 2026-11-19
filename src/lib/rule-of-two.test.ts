import { describe, expect, it } from "vitest";

import { checkSignerName, RULE_OF_TWO_ITEMS } from "@/lib/rule-of-two";

describe("règle de deux", () => {
  const coach = { first_name: "Marie-Ève", last_name: "Côté" };
  it("signature : le nom complet, accents et majuscules ignorés", () => {
    expect(checkSignerName("marie-eve cote", coach)).toBeNull();
    expect(checkSignerName("  MARIE ÈVE   CÔTÉ ", coach)).toBeNull();
    expect(checkSignerName("Marie", coach)).toMatch(/nom complet/);
    expect(checkSignerName("ab", coach)).toMatch(/prénom et ton nom/);
  });
  it("le texte couvre les six points de la règle", () => {
    expect(RULE_OF_TWO_ITEMS.map((i) => i.title)).toEqual(["Jamais seul", "Toujours un 2e adulte", "Communications", "Trajets", "Vestiaires", "Signaler"]);
  });
});

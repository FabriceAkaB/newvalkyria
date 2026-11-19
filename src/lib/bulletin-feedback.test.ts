import { describe, expect, it } from "vitest";

import { normalizeFeedback, summarizeFeedback } from "@/lib/bulletin-feedback";

const REG = "0b8c6a7e-1f2d-4c3b-9a8e-123456789abc";

describe("sondage court après le bulletin", () => {
  it("accepte oui / en partie / non, et le texte facultatif nettoyé", () => {
    expect(normalizeFeedback({ registrationId: REG, period: "mi-saison", useful: "en_partie", missing: "  plus   d'exemples  " })).toEqual({
      ok: true,
      value: { registrationId: REG, period: "mi-saison", useful: "en_partie", missing: "plus d'exemples" }
    });
    expect(normalizeFeedback({ registrationId: REG, period: "fin-saison", useful: "oui", missing: "   " })).toMatchObject({ ok: true, value: { missing: null } });
  });

  it("refuse une réponse inconnue, une période inconnue ou un texte trop long", () => {
    expect(normalizeFeedback({ registrationId: REG, period: "mi-saison", useful: "peut-etre" }).ok).toBe(false);
    expect(normalizeFeedback({ registrationId: REG, period: "hiver", useful: "oui" }).ok).toBe(false);
    expect(normalizeFeedback({ registrationId: "x", period: "mi-saison", useful: "oui" }).ok).toBe(false);
    expect(normalizeFeedback({ registrationId: REG, period: "mi-saison", useful: "oui", missing: "a".repeat(1001) }).ok).toBe(false);
    expect(normalizeFeedback(null).ok).toBe(false);
  });

  it("résume : part de oui et commentaires", () => {
    const s = summarizeFeedback([
      { period: "mi-saison", useful: "oui", missing: null },
      { period: "mi-saison", useful: "oui", missing: "vidéo" },
      { period: "mi-saison", useful: "non", missing: "plus de détails" },
      { period: "fin-saison", useful: "en_partie", missing: null }
    ]);
    expect(s).toEqual({ total: 4, oui: 2, enPartie: 1, non: 1, usefulRate: 50, withComment: 2 });
    expect(summarizeFeedback([]).usefulRate).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { CRITERIA_KEYS, cleanCriteria, familyAverages, isSheetComplete, matchCriteria, parseSheetQueue, positionGroup, presenceOf, scoreOn10 } from "@/lib/match-evaluation";

describe("fiche d'évaluation d'un match", () => {
  it("a 10 points et le critère du poste suit le poste joué", () => {
    expect(CRITERIA_KEYS).toHaveLength(10);
    expect(matchCriteria("GB").find((c) => c.key === "poste")!.label).toBe("Rôle de gardienne");
    expect(matchCriteria("AT").find((c) => c.key === "poste")!.label).toBe("Rôle d'attaquante");
    expect(positionGroup("MDC")).toBe("milieu");
    expect(positionGroup(null)).toBeNull();
  });

  it("garde seulement les notes de 1 à 5 et calcule la note sur 10", () => {
    const c = cleanCriteria({ controle: 5, passe: 3, dribble: 9, inconnu: 4, decision: "4", vitesse: 2.5 });
    expect(c).toEqual({ controle: 5, passe: 3, decision: 4 });
    expect(scoreOn10(c)).toBe(8);
    expect(scoreOn10({})).toBeNull();
    expect(familyAverages(c).find((f) => f.family === "Technique")!.avg).toBe(4);
  });

  it("une fiche est complète avec les 10 points et un mot", () => {
    const all = Object.fromEntries(CRITERIA_KEYS.map((k) => [k, 4]));
    expect(isSheetComplete({ criteria: all, comment: "" })).toBe(false);
    expect(isSheetComplete({ criteria: all, strengths: "Belle vision" })).toBe(true);
    expect(isSheetComplete({ criteria: { controle: 4 }, strengths: "x" })).toBe(false);
  });

  it("présente, à confirmer ou absente", () => {
    expect(presenceOf({ convocation: "confirmed" })).toBe("presente");
    expect(presenceOf({ convocation: "absent" })).toBe("absente");
    expect(presenceOf({ convocation: "absent", queuedPresent: true })).toBe("presente");
    expect(presenceOf({ inLineup: true, queuedPresent: false })).toBe("absente");
    expect(presenceOf({})).toBe("a_confirmer");
  });

  it("relit prudemment les fiches gardées sur l'appareil", () => {
    expect(parseSheetQueue(null)).toEqual([]);
    expect(parseSheetQueue("pas du json")).toEqual([]);
    const q = parseSheetQueue(JSON.stringify([{ registrationId: "r1", present: true, at: 5, criteria: { controle: 4, x: 2 } }, { registrationId: 3 }]));
    expect(q).toHaveLength(1);
    expect(q[0].criteria).toEqual({ controle: 4 });
    expect(q[0].strengths).toBe("");
  });
});

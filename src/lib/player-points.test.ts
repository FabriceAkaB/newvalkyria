import { describe, expect, it } from "vitest";

import { canRedeem, championPoints, checkChampions, DEFAULT_RULES, expiryStatus, normalizeRules, photoAllowed, pointsBalance, rewardsFor, shortName } from "@/lib/player-points";

const R = DEFAULT_RULES;

describe("barème", () => {
  it("reprend le barème par défaut pour une valeur manquante ou invalide", () => {
    expect(normalizeRules(null)).toEqual(R);
    expect(normalizeRules('{"groupe": 8, "presence": "abc", "bienvenue": -4}')).toEqual({ ...R, groupe: 8 });
    expect(normalizeRules({ individuel: 40, maxParPratique: 10 }).maxParPratique).toBe(40);
  });

  it("donne les points selon le type de championne ; une partie spéciale reste sous son maximum", () => {
    expect(championPoints("individuel", R)).toBe(R.individuel);
    expect(championPoints("groupe", R)).toBe(R.groupe);
    expect(championPoints("attitude", R)).toBe(R.attitude);
    expect(championPoints("special", R, 20)).toBe(20);
    expect(championPoints("special", R, 999)).toBe(R.specialMax);
    expect(championPoints("special", R, 0)).toBe(1);
  });
});

describe("championnes du jour", () => {
  const nameOf = (id: string) => ({ a: "Léa", b: "Maya" })[id] ?? id;
  it("une gagnante seule, un groupe d'au moins 2", () => {
    expect(checkChampions({ kind: "individuel", ids: ["a", "b"], points: 10, rules: R, already: new Map(), nameOf })).toMatch(/une fille/);
    expect(checkChampions({ kind: "groupe", ids: ["a"], points: 5, rules: R, already: new Map(), nameOf })).toMatch(/au moins 2/);
    expect(checkChampions({ kind: "groupe", ids: ["a", "b"], points: 5, rules: R, already: new Map(), nameOf })).toBeNull();
    expect(checkChampions({ kind: "attitude", ids: [], points: 10, rules: R, already: new Map(), nameOf })).toMatch(/au moins une/);
  });

  it("refuse de dépasser le maximum par pratique et nomme la fille", () => {
    expect(checkChampions({ kind: "individuel", ids: ["b"], points: 10, rules: R, already: new Map([["b", 25]]), nameOf })).toMatch(/Maya a déjà 25/);
  });

  it("photo seulement si toutes les filles ont l'autorisation", () => {
    expect(photoAllowed([true, true])).toBe(true);
    expect(photoAllowed([true, null])).toBe(false);
    expect(photoAllowed([])).toBe(false);
  });

  it("prénom et initiale pour les autres familles", () => {
    expect(shortName(" Léa ", "démo")).toBe("Léa D.");
  });
});

describe("solde", () => {
  it("bienvenue + présences + championne, moins les dépenses et l'expiration ; une demande annulée ne compte pas", () => {
    const b = pointsBalance(4, [
      { kind: "victoire", points: 10 },
      { kind: "attitude", points: 10 },
      { kind: "bonus", points: 5 },
      { kind: "echange", points: -30, status: "remise" },
      { kind: "echange", points: -40, status: "annulee" }
    ]);
    expect(b).toEqual({ presence: 20, bienvenue: 25, victoires: 1, attitudes: 1, earned: 70, spent: 30, expired: 0, balance: 40 });
    const after = pointsBalance(4, [{ kind: "victoire", points: 10 }, { kind: "expiration", points: -55 }]);
    expect(after.balance).toBe(0);
    expect(after.earned).toBe(55);
  });

  it("une saisie de présence en retard met le total à jour (calculé, jamais copié)", () => {
    expect(pointsBalance(3, []).balance).toBe(40);
    expect(pointsBalance(4, []).balance).toBe(45);
  });
});

describe("récompenses et fin de saison", () => {
  it("donne les récompenses accessibles et la prochaine", () => {
    const r = rewardsFor(40, [{ id: "b", name: "Bracelet", cost: 50 }, { id: "a", name: "Choisir le jeu", cost: 20 }, { id: "c", name: "Ballon", cost: 150 }]);
    expect(r.available.map((x) => x.name)).toEqual(["Choisir le jeu"]);
    expect(r.next?.name).toBe("Bracelet");
  });

  it("refuse une demande sans assez de points ou après la saison", () => {
    expect(canRedeem({ balance: 40, cost: 50, expired: false })).toMatch(/manque 10/);
    expect(canRedeem({ balance: 60, cost: 50, expired: true })).toMatch(/terminée/);
    expect(canRedeem({ balance: 60, cost: 50, expired: false })).toBeNull();
  });

  it("rappelle 30 jours avant la fin, insiste la dernière semaine, expire après", () => {
    expect(expiryStatus("2027-04-18", "2027-03-01").phase).toBe("loin");
    expect(expiryStatus("2027-04-18", "2027-03-25").phase).toBe("bientot");
    expect(expiryStatus("2027-04-18", "2027-04-18")).toEqual({ daysLeft: 0, phase: "dernier" });
    expect(expiryStatus("2027-04-18", "2027-04-19").phase).toBe("expire");
  });
});

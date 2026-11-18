import { describe, expect, it } from "vitest";
import { computeLaunch, normalizeInputs } from "@/lib/launch-calculator";
import { agendaSteps, countInterest, evaluateProject, probableSignups, sortByDecision } from "@/lib/project-pipeline";

const camp = (over: Record<string, unknown> = {}) => {
  const inputs = normalizeInputs({ priceCents: 30_000, capacity: 20, sessions: 5, hoursPerSession: 6, fieldMode: "contract", fieldContractCents: 60_000, coachCount: 2, coachHourlyCents: 2_000, jpHours: 20, ...over });
  return { inputs, results: computeLaunch(inputs, "2026-11-17") };
};

describe("projets à lancer", () => {
  it("compte les oui, peut-être et non", () => {
    expect(countInterest(["Oui, très intéressée", "Peut-être", "Non", "", null, ["Oui, très intéressée"]])).toEqual({ yes: 2, maybe: 1, no: 1, answered: 4 });
  });

  it("les inscrites probables : la moitié des oui, 15 % des peut-être, jamais plus que les places", () => {
    expect(probableSignups({ yes: 10, maybe: 10, no: 0, answered: 20 })).toBe(6);
    expect(probableSignups({ yes: 60, maybe: 0, no: 0, answered: 60 }, 20)).toBe(20);
  });

  it("à chiffrer tant que le calculateur n'a pas de prix", () => {
    expect(evaluateProject({ yes: 3, maybe: 1, no: 0, answered: 4 }, null).decision).toBe("a-chiffrer");
    expect(evaluateProject({ yes: 0, maybe: 0, no: 0, answered: 0 }, null).decision).toBe("en-attente");
  });

  it("pas assez d'intérêt sous le seuil de survie", () => {
    const e = evaluateProject({ yes: 4, maybe: 0, no: 5, answered: 9 }, camp());
    expect(e.decision).toBe("pas-assez");
    expect(e.probable).toBe(2);
  });

  it("à lancer quand l'intérêt dépasse le seuil et que l'heure de JP rapporte assez", () => {
    const e = evaluateProject({ yes: 40, maybe: 0, no: 0, answered: 40 }, camp());
    expect(e.decision).toBe("lancer");
    expect(e.profitPerJpHourCents).toBeGreaterThan(5_000);
  });

  it("la subvention s'ajoute à part, sans changer le verdict", () => {
    const sans = evaluateProject({ yes: 4, maybe: 0, no: 5, answered: 9 }, camp());
    const avec = evaluateProject({ yes: 4, maybe: 0, no: 5, answered: 9 }, camp({ grantCents: 400_000 }));
    expect(avec.decision).toBe(sans.decision);
    expect(avec.profitWithGrantCents).toBe((sans.profitCents ?? 0) + 400_000);
  });

  it("à risque quand le projet mange trop d'heures de JP", () => {
    expect(evaluateProject({ yes: 40, maybe: 0, no: 0, answered: 40 }, camp({ jpHours: 400 })).decision).toBe("a-risque");
  });

  it("trie : à lancer d'abord, pas rentable en dernier", () => {
    const rows = [
      { k: "a", evaluation: evaluateProject({ yes: 4, maybe: 0, no: 0, answered: 4 }, camp()) },
      { k: "b", evaluation: evaluateProject({ yes: 40, maybe: 0, no: 0, answered: 40 }, camp()) },
      { k: "c", evaluation: evaluateProject({ yes: 1, maybe: 0, no: 0, answered: 1 }, null) }
    ];
    expect(sortByDecision(rows).map((r) => r.k)).toEqual(["b", "c", "a"]);
  });

  it("place les étapes 60, 45 et 14 jours avant, jamais dans le passé", () => {
    const steps = agendaSteps("Camp des Fêtes", "2026-12-28", "2026-11-17");
    expect(steps.map((s) => s.due)).toEqual(["2026-11-17", "2026-11-17", "2026-12-14"]);
    expect(agendaSteps("Été", "2027-06-28", "2026-11-17").map((s) => s.due)).toEqual(["2027-04-29", "2027-05-14", "2027-06-14"]);
  });
});

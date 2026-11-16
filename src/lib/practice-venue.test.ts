import { describe, expect, it } from "vitest";

import { venueOf } from "@/lib/practice-venue";

describe("venueOf", () => {
  const saison = (date: string, location = "Sainte-Thérèse") => venueOf({ date, location, group: "Filles 2016", source: "saison" });
  it("lundi et mercredi : gymnase double", () => {
    expect(saison("2026-11-16")).toBe("gym-double");
    expect(saison("2026-11-18")).toBe("gym-double");
  });
  it("jeudi : deux tiers du gymnase", () => {
    expect(saison("2026-11-19", "École des Falaises, Prévost")).toBe("gym-deux-tiers");
  });
  it("pratique d'équipe : synthétique à 7, même un samedi", () => {
    expect(venueOf({ date: "2026-11-29", location: "Complexe sportif Terrebonne, terrain #4", group: "Équipe 2016-2017 AV et INT", source: "activite" })).toBe("synthetique");
    expect(venueOf({ date: "2026-12-05", location: "Centre multisports de Rosemère (CMR)", group: "Équipe 2015 AV et INT", source: "activite" })).toBe("synthetique");
  });
  it("le reste : autre", () => {
    expect(venueOf({ date: "2026-11-21", location: "École Chambéry (gym / futsal)", group: "Programme intensif garçons 2015", source: "activite" })).toBe("autre");
  });
});

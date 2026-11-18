import { describe, expect, it } from "vitest";

import { eveEmail } from "@/lib/coach-eve-reminder";

describe("rappel de la veille aux éducateurs", () => {
  it("dit quand, où, le thème et les exercices dans l'ordre, avec le lien", () => {
    const m = eveEmail({ firstName: "Sam", date: "2026-11-18", start: "18:00:00", end: "19:25:00", group: "Filles 2016-2017", location: "École de la Voltige", theme: "Conduite tête levée", blocks: [{ title: "Rondo 4c1", minutes: 12 }, { title: "Match à thème", minutes: 20 }], url: "https://www.newvalkyria.com/entraineur/activites/x" });
    expect(m.subject).toBe("Demain 18 h 00 : ta pratique Filles 2016-2017, à repérer avant d'arriver");
    expect(m.text).toContain("mercredi 18 novembre, 18 h 00 à 19 h 25, École de la Voltige");
    expect(m.text).toContain("1. Rondo 4c1 (12 min)\n2. Match à thème (20 min)");
    expect(m.html).toContain("Conduite tête levée");
    expect(m.html).toContain("https://www.newvalkyria.com/entraineur/activites/x");
  });
  it("sans plan, annonce qu'il arrive", () => {
    expect(eveEmail({ firstName: "Sam", date: "2026-11-18", start: "18:00", end: "19:00", group: "G", location: null, theme: null, blocks: [], url: "u" }).text).toContain("Le plan arrive");
  });
});

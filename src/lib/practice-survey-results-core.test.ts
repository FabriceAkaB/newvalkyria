import { describe, expect, it } from "vitest";

import { canSeeSurveyResults, coachNames, girlName, parsePeriod, pctOf, rankHelpers, rankHelpersOverPeriod, sameField, summarizeResults, topPeers, type ResultRow } from "@/lib/practice-survey-results-core";

const row = (o: Partial<ResultRow>): ResultRow => ({
  registrationId: o.registrationId ?? Math.random().toString(36).slice(2),
  name: o.name ?? "Fille",
  practiceRating: null,
  fatigue: null,
  coachHelped: null,
  coachHelpers: [],
  peerHelped: null,
  peerHelpers: [],
  themeAnswer: null,
  themeCorrect: null,
  wantsMore: [],
  ...o
});

describe("rankHelpers", () => {
  const field = [
    { id: "a", name: "Annie" },
    { id: "b", name: "Bruno" },
    { id: "c", name: "Chloé" }
  ];
  it("classe par nombre de filles aidées, avec le % des filles qui ont répondu à la question", () => {
    const rows = [
      row({ coachHelped: true, coachHelpers: ["b"] }),
      row({ coachHelped: true, coachHelpers: ["b", "a"] }),
      row({ coachHelped: true, coachHelpers: ["b"] }),
      row({ coachHelped: false }),
      row({ practiceRating: 8 }) // pas répondu à la question de la coach
    ];
    const r = rankHelpers(rows, field);
    expect(r.map((x) => [x.name, x.helped, x.rank, x.pct])).toEqual([
      ["Bruno", 3, 1, 75],
      ["Annie", 1, 2, 25],
      ["Chloé", 0, 3, 0]
    ]);
    expect(r.every((x) => x.asked === 4)).toBe(true);
  });

  it("donne le même rang aux égalités, puis saute (1, 1, 3)", () => {
    const rows = [row({ coachHelped: true, coachHelpers: ["a", "c"] }), row({ coachHelped: true, coachHelpers: ["a", "c", "b"] }), row({ coachHelped: true, coachHelpers: ["a", "c"] })];
    const r = rankHelpers(rows, field);
    expect(r.map((x) => [x.name, x.rank, x.tied])).toEqual([
      ["Annie", 1, true],
      ["Chloé", 1, true],
      ["Bruno", 3, false]
    ]);
  });

  it("ajoute l'éducateur nommé même s'il n'était pas assigné (groupe voisin à la même heure)", () => {
    const r = rankHelpers([row({ coachHelped: true, coachHelpers: ["z"] })], [{ id: "a", name: "Annie" }], new Map([["z", "Zoé"]]));
    expect(r.map((x) => [x.name, x.helped, x.rank])).toEqual([
      ["Zoé", 1, 1],
      ["Annie", 0, 2]
    ]);
  });

  it("sans réponse à la question : pourcentage absent", () => {
    expect(rankHelpers([row({ practiceRating: 9 })], [{ id: "a", name: "Annie" }])[0]).toMatchObject({ helped: 0, asked: 0, pct: null, rank: 1, tied: false });
  });
});

describe("rankHelpersOverPeriod", () => {
  it("additionne les pratiques et recalcule le rang", () => {
    const p1 = rankHelpers([row({ coachHelped: true, coachHelpers: ["a"] }), row({ coachHelped: false })], [{ id: "a", name: "Annie" }, { id: "b", name: "Bruno" }]);
    const p2 = rankHelpers([row({ coachHelped: true, coachHelpers: ["b"] }), row({ coachHelped: true, coachHelpers: ["b"] })], [{ id: "b", name: "Bruno" }]);
    const r = rankHelpersOverPeriod([{ ranking: p1 }, { ranking: p2 }]);
    expect(r.map((x) => [x.name, x.helped, x.asked, x.pct, x.practices, x.rank])).toEqual([
      ["Bruno", 2, 4, 50, 2, 1],
      ["Annie", 1, 2, 50, 1, 2]
    ]);
  });
  it("ignore les pratiques où la question de la coach n'a pas été posée", () => {
    const old = rankHelpers([row({ practiceRating: 9 })], [{ id: "w", name: "William" }]);
    expect(rankHelpersOverPeriod([{ ranking: old }])).toEqual([]);
  });
});

describe("summarizeResults", () => {
  it("moyennes, parts et « plus de »", () => {
    const s = summarizeResults([
      row({ practiceRating: 8, fatigue: 4, coachHelped: true, coachHelpers: ["a"], peerHelped: false, themeCorrect: true, wantsMore: ["matchs"] }),
      row({ practiceRating: 9, fatigue: 5, coachHelped: false, peerHelped: true, peerHelpers: ["x"], themeCorrect: false, wantsMore: ["matchs", "tirs"] }),
      row({ practiceRating: 10 })
    ]);
    expect(s.respondents).toBe(3);
    expect(s.pleasure).toBe(9);
    expect(s.fatigue).toBe(4.5);
    expect(s.coachHelp).toEqual({ yes: 1, answered: 2, pct: 50 });
    expect(s.peerHelp).toEqual({ yes: 1, answered: 2, pct: 50 });
    expect(s.theme).toEqual({ understood: 1, answered: 2, pct: 50 });
    expect(s.wants.map((w) => [w.key, w.count])).toEqual([
      ["matchs", 2],
      ["tirs", 1]
    ]);
  });
  it("vide", () => {
    expect(summarizeResults([])).toMatchObject({ respondents: 0, pleasure: null, coachHelp: { pct: null }, theme: { pct: null } });
  });
});

describe("petits outils", () => {
  it("pctOf", () => {
    expect(pctOf(1, 3)).toBe(33);
    expect(pctOf(2, 3)).toBe(67);
    expect(pctOf(0, 0)).toBeNull();
  });
  it("girlName : prénom + initiale", () => {
    expect(girlName("léa-rose", "MARTIN")).toBe("Léa-Rose M.");
    expect(girlName("Emma", "")).toBe("Emma");
    expect(girlName("", null)).toBe("Joueuse");
  });
  it("coachNames : initiale seulement si deux prénoms pareils", () => {
    const m = coachNames([
      { id: "1", first: "julie", last: "Roy" },
      { id: "2", first: "Julie", last: "Tremblay" },
      { id: "3", first: "Marc", last: "Côté" }
    ]);
    expect([m.get("1"), m.get("2"), m.get("3")]).toEqual(["Julie R.", "Julie T.", "Marc"]);
  });
  it("topPeers", () => {
    const t = topPeers([row({ peerHelpers: ["x", "y"] }), row({ peerHelpers: ["x"] }), row({ peerHelpers: ["inconnue"] })], new Map([["x", "Ana B."], ["y", "Zoé C."]]));
    expect(t).toEqual([
      { id: "x", name: "Ana B.", count: 2 },
      { id: "y", name: "Zoé C.", count: 1 }
    ]);
  });
  it("sameField : 15 minutes près, même endroit", () => {
    expect(sameField({ date: "2026-11-23", start: "19:30", location: "Gym" }, { date: "2026-11-23", start: "19:45", location: "Gym" })).toBe(true);
    expect(sameField({ date: "2026-11-23", start: "19:30", location: "Gym" }, { date: "2026-11-23", start: "19:50", location: "Gym" })).toBe(false);
    expect(sameField({ date: "2026-11-23", start: "19:30", location: "Gym" }, { date: "2026-11-23", start: "19:30", location: "Parc" })).toBe(false);
  });
});

describe("canSeeSurveyResults", () => {
  const today = "2026-11-25";
  const practice = { activity_date: "2026-10-01", activity_type: "Pratique", organization: null };
  it("toute l'équipe voit une pratique passée de l'Académie", () => {
    expect(canSeeSurveyResults({ coachActive: true, assigned: false, activity: practice, today })).toBe(true);
  });
  it("pas une pratique future, hors Académie ou un match, sauf si assigné", () => {
    expect(canSeeSurveyResults({ coachActive: true, assigned: false, activity: { ...practice, activity_date: "2026-11-26" }, today })).toBe(false);
    expect(canSeeSurveyResults({ coachActive: true, assigned: false, activity: { ...practice, organization: "Autre club" }, today })).toBe(false);
    expect(canSeeSurveyResults({ coachActive: true, assigned: false, activity: { ...practice, activity_type: "Match" }, today })).toBe(false);
    expect(canSeeSurveyResults({ coachActive: true, assigned: true, activity: { ...practice, organization: "Autre club" }, today })).toBe(true);
  });
  it("jamais un éducateur inactif", () => {
    expect(canSeeSurveyResults({ coachActive: false, assigned: true, activity: practice, today })).toBe(false);
  });
});

describe("parsePeriod", () => {
  const today = "2026-11-25";
  it("par défaut : 28 jours", () => {
    expect(parsePeriod({}, today)).toEqual({ from: "2026-10-29", to: today, days: 28 });
  });
  it("raccourcis 7 et 70 jours", () => {
    expect(parsePeriod({ jours: "7" }, today)).toEqual({ from: "2026-11-19", to: today, days: 7 });
    expect(parsePeriod({ jours: "70" }, today).from).toBe("2026-09-17");
  });
  it("dates données, inversées remises dans l'ordre, au plus 1 an", () => {
    expect(parsePeriod({ du: "2026-11-20", au: "2026-11-10" }, today)).toEqual({ from: "2026-11-10", to: "2026-11-20", days: null });
    expect(parsePeriod({ du: "2020-01-01", au: "2026-11-25" }, today).from).toBe("2025-11-25");
    expect(parsePeriod({ du: "pas une date" }, today).from).toBe("2026-10-29");
  });
});

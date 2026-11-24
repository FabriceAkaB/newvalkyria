import { describe, expect, it } from "vitest";

import { costPerPlayerCents, costRange, datesLabel, isEligible, isExpired, nextOffers, payDeadline, planGo, playerKey, progress, queue, readSettings, reminderAt, surveySaysInterested, tally, type ResponseLite } from "@/lib/tournaments-core";

const s = readSettings({ tournament: { entryFeeCents: 110000, coachFeeCents: 30000, teams: 1 } });
const r = (id: string, response: ResponseLite["response"], at: string, offerStatus: ResponseLite["offerStatus"] = null): ResponseLite => ({ id, response, respondedAt: `2026-11-${at}T12:00:00Z`, offerStatus });

describe("coût par joueuse", () => {
  it("(inscription + coach) par équipe, divisé par les joueuses, arrondi au dollar supérieur", () => {
    expect(costPerPlayerCents(s, 12)).toBe(11700); // 1 400 $ / 12 = 116,67 $ → 117 $
    expect(costPerPlayerCents(s, 14)).toBe(10000);
    expect(costPerPlayerCents({ ...s, teams: 2 }, 24)).toBe(11700);
    expect(costPerPlayerCents(s, 0)).toBeNull();
  });
  it("fourchette : au minimum (le plus cher) et à l'équipe complète", () => {
    expect(costRange(s, 10, 14)).toEqual({ high: 14000, low: 10000 });
  });
  it("réglages par défaut", () => {
    const d = readSettings(null);
    expect(d.teams).toBe(1);
    expect(d.payDays).toBe(7);
    expect(d.reminderHours).toBe(48);
    expect(d.go).toBeNull();
  });
});

describe("réponses et minimum", () => {
  const rows = [r("a", "disponible", "20"), r("b", "interessee", "19"), r("c", "pas_cette_fois", "18"), r("d", "interessee", "21", "payee"), r("e", "disponible", "19")];
  it("compte chaque réponse", () => {
    expect(tally(rows)).toEqual({ disponible: 2, interessee: 2, pasCetteFois: 1, offered: 0, paid: 1 });
  });
  it("la barre compte les disponibles et celles qui ont payé", () => {
    expect(progress(rows, 10)).toEqual({ count: 3, min: 10, pct: 30, reached: false });
    expect(progress(rows, 3).reached).toBe(true);
  });
  it("la file : disponibles d'abord, premières répondues d'abord, puis les intéressées", () => {
    expect(queue(rows).map((x) => x.id)).toEqual(["e", "a", "b"]);
  });
});

describe("go et places", () => {
  it("au go, seules les disponibles reçoivent une place, jusqu'au maximum", () => {
    const rows = [r("a", "disponible", "20"), r("b", "disponible", "19"), r("c", "disponible", "21"), r("d", "interessee", "18")];
    expect(planGo(rows, 2)).toEqual({ offer: ["b", "a"], waiting: ["c"] });
  });
  it("une place qui expire passe à la suivante (disponible, sinon intéressée)", () => {
    const rows = [r("a", "disponible", "20", "expiree"), r("b", "disponible", "19", "payee"), r("c", "interessee", "21"), r("d", "disponible", "22")];
    expect(nextOffers(rows, 2)).toEqual(["d"]);
    expect(nextOffers(rows, 3)).toEqual(["d", "c"]);
    expect(nextOffers([...rows, r("e", "disponible", "23", "offerte")], 2)).toEqual([]);
  });
  it("date limite, rappel et expiration", () => {
    const now = new Date("2027-01-10T15:00:00Z");
    const deadline = payDeadline(now, 7);
    expect(deadline).toBe("2027-01-18T04:59:00.000Z"); // 17 janv. 23 h 59 à Montréal
    expect(reminderAt(now, deadline, 48)).toBe("2027-01-16T04:59:00.000Z");
    expect(reminderAt(now, new Date(now.getTime() + 3_600_000).toISOString(), 48)).toBe("2027-01-10T16:00:00.000Z");
    expect(isExpired("offerte", deadline, new Date("2027-01-18T05:00:00Z"))).toBe(true);
    expect(isExpired("payee", deadline, new Date("2027-01-18T05:00:00Z"))).toBe(false);
  });
});

describe("joueuses visées", () => {
  const av = readSettings({ tournament: { advancedOnly: true } });
  it("années et groupe avancé", () => {
    expect(isEligible({ birthYear: 2015, programId: "TVA", advanced: true }, av, ["2015"])).toBe(true);
    expect(isEligible({ birthYear: 2015, programId: "TV", advanced: false }, av, ["2015"])).toBe(false);
    expect(isEligible({ birthYear: 2016, programId: "TVA", advanced: true }, av, ["2015"])).toBe(false);
    expect(isEligible({ birthYear: 2016, programId: "SV", advanced: false }, readSettings({ tournament: { programIds: ["TVA"] } }), [])).toBe(false);
  });
  it("la catégorie compte aussi : née en 2014, elle joue en 2015", () => {
    expect(isEligible({ birthYear: 2014, years: [2015], programId: "TVA", advanced: true }, av, ["2015"])).toBe(true);
    expect(isEligible({ birthYear: null, years: [], programId: "TVA", advanced: true }, av, ["2015"])).toBe(false);
  });
  it("un tournoi d'essai ne vise que la famille de démonstration, jamais l'inverse", () => {
    const test = readSettings({ tournament: { test: true } });
    expect(isEligible({ birthYear: 2016, programId: "TV", advanced: false, demo: true }, test, ["2016"])).toBe(true);
    expect(isEligible({ birthYear: 2016, programId: "TV", advanced: false }, test, ["2016"])).toBe(false);
    expect(isEligible({ birthYear: 2016, programId: "TV", advanced: false, demo: true }, readSettings({}), ["2016"])).toBe(false);
  });
  it("clé de joueuse sans accents ni majuscules", () => {
    expect(playerKey(" Élodie ", "Tétreault-Delisle")).toBe("elodie tetreault delisle");
  });
  it("le sondage d'intérêt : oui + la date cochée", () => {
    const answers = { "tournoi-av-ontario": "Oui, très intéressée", tournois: ["Family Day Cup : 14 et 15 février 2027 (le lundi 15 est un jour d'école au Québec)"] };
    expect(surveySaysInterested(answers, "tournoi-av-ontario", "Family Day Cup")).toBe(true);
    expect(surveySaysInterested(answers, "tournoi-av-ontario", "Easter Cup")).toBe(false);
    expect(surveySaysInterested({ ...answers, "tournoi-av-ontario": "Peut-être" }, "tournoi-av-ontario", "Family Day Cup")).toBe(false);
  });
  it("dates en mots", () => {
    expect(datesLabel(["2027-02-14", "2027-02-15"])).toBe("14 et 15 février 2027");
    expect(datesLabel(["2027-03-29"])).toBe("lundi 29 mars 2027");
    expect(datesLabel([])).toBe("Dates à confirmer");
  });
});

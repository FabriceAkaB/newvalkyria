import { describe, expect, it } from "vitest";

import { calendarWeeks, interviewsPerWeek, slotRemaining, weekQuotas, weekStart } from "@/lib/content-core";

describe("Création de contenu : règles", () => {
  it("la semaine commence le dimanche", () => {
    expect(weekStart("2026-11-13")).toBe("2026-11-08");
    expect(weekStart("2026-11-08")).toBe("2026-11-08");
    expect(weekStart("2026-11-14")).toBe("2026-11-08");
  });

  it("rythme des entrevues pour atteindre l'objectif avant la fin de la saison", () => {
    // 30 entrevues à faire du 21 nov. au 18 avr. (~22 semaines) : 2 par semaine.
    expect(interviewsPerWeek(0, "2026-11-13")).toBe(2);
    expect(interviewsPerWeek(30, "2026-12-01")).toBe(0);
    // En retard : il en reste 20 à 3 semaines de la fin.
    expect(interviewsPerWeek(10, "2027-03-28")).toBe(7);
  });

  it("une journée d'entrevues ne compte pas les familles qui ont décliné", () => {
    const slot = { id: "s1", day: "2026-11-21", start_time: "09:00", end_time: "11:00", place: "x", capacity: 3, note: null };
    expect(slotRemaining(slot, [{ slot_id: "s1", status: "confirmee" }, { slot_id: "s1", status: "decline" }, { slot_id: "s2", status: "confirmee" }])).toBe(2);
    expect(slotRemaining(slot, [{ slot_id: "s1", status: "confirmee" }, { slot_id: "s1", status: "filmee" }, { slot_id: "s1", status: "invitee" }, { slot_id: "s1", status: "confirmee" }])).toBe(0);
  });

  it("quotas de la semaine : photos à chaque match, 360° à chaque pratique en gymnase", () => {
    const q = weekQuotas({ published: 2, practices: 6, captured360: 4, matches: 3, matchPhotos: 1, veoPractices: 0, interviewsFilmed: 1, interviewsPerWeek: 2 });
    expect(q.find((x) => x.key === "ball360")).toMatchObject({ done: 4, target: 6 });
    expect(q.find((x) => x.key === "photos")).toMatchObject({ done: 1, target: 3 });
    expect(q.find((x) => x.key === "publications")?.target).toBe(3);
  });

  it("calendrier : 7 jours par semaine, chaque élément à sa date", () => {
    const w = calendarWeeks([{ date: "2026-11-17", kind: "prevu", title: "Reel ball mastery", postKind: "essai", angle: null, networks: [] }], "2026-11-13", 2);
    expect(w).toHaveLength(2);
    expect(w[0].start).toBe("2026-11-08");
    expect(w[1].days[2].date).toBe("2026-11-17");
    expect(w[1].days[2].items).toHaveLength(1);
  });
});

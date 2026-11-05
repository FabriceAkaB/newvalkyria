import { describe, expect, it } from "vitest";

import { mcsFeedTitle, mergePersonalFeed, type CalendarEvent } from "@/lib/calendar-repo";

const site = (p: Partial<CalendarEvent>): CalendarEvent => ({ id: "s", date: "2026-11-14", startTime: "18:15:00", endTime: "19:00:00", kind: "activite", activityType: null, title: "Site", location: null, terrainId: null, category: null, coachNames: null, ...p });

describe("agenda personnel de JP", () => {
  it("nettoie le titre MCS et met l'équipe devant", () => {
    expect(mcsFeedTitle("Event Vendredi Solo - Pratique finition (45 min) – Nelly Piché", "Vendredi Solo")).toBe("Pratique finition (45 min) – Nelly Piché");
    expect(mcsFeedTitle("Event Équipe 2015 AV - Pratique sur synthétique", "Équipe 2015 AV")).toBe("Équipe 2015 AV · Pratique sur synthétique");
    expect(mcsFeedTitle("Event Programme intensif  Garçons - 2014 - Pratique Programme Intensif", "Programme intensif Garçons 2014")).toBe("Programme intensif Garçons 2014 · Pratique Programme Intensif");
    expect(mcsFeedTitle("Événement Lundi 2014-2015 - Pratique en gym", "Lundi 2014-2015")).toBe("Lundi 2014-2015 · Pratique en gym");
    expect(mcsFeedTitle("Pre-season Équipe 2016-2017 AV vs. À déterminer (équipe extérieure)", "Équipe 2016-2017 AV")).toBe("Équipe 2016-2017 AV · Match c. À déterminer (équipe extérieure)");
  });

  it("garde tout MCS, ajoute le site sans doublon, sans les essais", () => {
    const out = mergePersonalFeed(
      [{ key: "event-1@monclubsportif.com|1", event_date: "2026-11-14", start_time: "18:15", end_time: "19:00", title: "Event Vendredi Solo - Pratique finition (45 min) – Nelly Piché", location: null, team: "Vendredi Solo" }],
      [site({ id: "a" }), site({ id: "b", date: "2027-03-20", startTime: "09:15:00", title: "Match Cadet D4 St-Gabriel", organization: "Saint-Gabriel" }), site({ id: "c", kind: "essai", startTime: null })]
    );
    expect(out.map((e) => e.title)).toEqual(["Pratique finition (45 min) – Nelly Piché", "Match Cadet D4 St-Gabriel"]);
    expect(out[0].id).not.toMatch(/[@|]/);
  });
});

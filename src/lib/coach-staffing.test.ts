import { describe, expect, it } from "vitest";

import { ASSIGNED_BY_MCS, assignmentPlan, coachIntent, mergeSlotCoaches, shortageDue, shortageTask, slotLabel, staffingOf, type SlotCoach } from "@/lib/coach-staffing";

const c = (coachId: string, name: string, state: string): SlotCoach => ({ coachId, name, intent: coachIntent(state) });

describe("éducateurs d'une pratique (MonClubSportif fait foi)", () => {
  it("présent ou en retard = vient ; absent ; le reste = pas de réponse", () => {
    expect(["present", "late", "absent", "unknown", "uncertain", undefined].map(coachIntent)).toEqual(["vient", "vient", "absent", "sans-reponse", "sans-reponse", "sans-reponse"]);
  });

  it("deux équipes à la même heure : un éducateur compte une fois, avec sa réponse la plus claire", () => {
    const merged = mergeSlotCoaches([c("jp", "Jean-Paul", "present"), c("m", "Maéva", "unknown"), c("jp", "Jean-Paul", "unknown"), c("m", "Maéva", "present")]);
    expect(merged.map((x) => `${x.coachId}:${x.intent}`)).toEqual(["jp:vient", "m:vient"]);
    expect(staffingOf(merged).ok).toBe(true);
  });

  it("il manque un éducateur quand un seul a dit présent", () => {
    const s = staffingOf([c("jp", "Jean-Paul", "present"), c("m", "Maéva", "absent"), c("n", "Noura", "unknown")]);
    expect(s.missing).toBe(1);
    expect(s.ok).toBe(false);
  });

  it("assignations : ajoute les présents, passe les absents, enlève seulement ce que MCS avait ajouté", () => {
    const plan = assignmentPlan(
      [
        { id: "a1", coachId: "m", status: "present", assignedBy: null, confirmed: false, paid: false },
        { id: "a2", coachId: "n", status: "present", assignedBy: ASSIGNED_BY_MCS, confirmed: false, paid: false },
        { id: "a3", coachId: "w", status: "present", assignedBy: null, confirmed: false, paid: false },
        { id: "a4", coachId: "x", status: "absent", assignedBy: ASSIGNED_BY_MCS, confirmed: false, paid: false },
        { id: "a5", coachId: "y", status: "present", assignedBy: null, confirmed: true, paid: false }
      ],
      [c("jp", "Jean-Paul", "present"), c("m", "Maéva", "absent"), c("n", "Noura", "unknown"), c("w", "William", "unknown"), c("x", "X", "present"), c("y", "Y", "absent")]
    );
    expect(plan).toEqual({ insert: ["jp"], absent: ["a1"], present: ["a4"], remove: ["a2"] });
  });

  it("la tâche est due 3 jours avant, ou aujourd'hui si c'est plus proche", () => {
    expect(shortageDue("2026-11-30", "2026-11-16")).toBe("2026-11-27");
    expect(shortageDue("2026-11-18", "2026-11-16")).toBe("2026-11-16");
  });

  it("titre et détails de la tâche", () => {
    expect(slotLabel("2026-11-23", "18:00")).toBe("lun. 23 nov. 18 h");
    const t = shortageTask({ date: "2026-11-23", start: "19:30", group: "Filles 2014-2015", coaches: [c("jp", "Jean-Paul Aka", "present"), c("m", "Maéva Desjardins", "absent"), c("n", "Noura Ouattara", "unknown")] });
    expect(t.title).toBe("Trouver un 2e éducateur : lun. 23 nov. 19 h 30, Filles 2014-2015");
    expect(t.details).toContain("présent dans MonClubSportif : Jean-Paul");
    expect(t.details).toContain("Absente".slice(0, 6));
    expect(t.details).toContain("Pas encore répondu : Noura");
  });
});

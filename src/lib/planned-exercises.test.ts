import { describe, expect, it } from "vitest";

import { computeReport, reportMissing } from "@/lib/coach-report";
import { answerPatch, blockAnswer, blockTitle, journalOutcome, outcomeDone, plannedMissingLabel, plannedRequired, plannedSummary, PLANNED_EXERCISES_RULE_START } from "@/lib/planned-exercises";

describe("Exercices prévus : faits ?", () => {
  it("lit la réponse d'un bloc : Non, Oui ou rien", () => {
    expect(blockAnswer({ not_done: true })).toBe("non");
    expect(blockAnswer({ not_done: true, not_done_at: "2026-11-26T20:00:00Z" })).toBe("non");
    expect(blockAnswer({ not_done: false, not_done_at: "2026-11-26T20:00:00Z" })).toBe("oui");
    expect(blockAnswer({ not_done: false, not_done_at: null })).toBeNull();
    expect(blockAnswer({})).toBeNull();
  });

  it("résume les blocs répondus", () => {
    const s = plannedSummary([{ not_done: true }, { not_done: false, not_done_at: "x" }, { not_done: false }]);
    expect(s).toEqual({ total: 3, answered: 2, done: 1, notDone: 1, complete: false });
    expect(plannedSummary([]).complete).toBe(true);
  });

  it("compte dans le rapport à partir du 26 nov. 2026 seulement, s'il y a un plan", () => {
    expect(PLANNED_EXERCISES_RULE_START).toBe("2026-11-26");
    expect(plannedRequired("2026-11-25", 5)).toBe(false);
    expect(plannedRequired("2026-11-26", 5)).toBe(true);
    expect(plannedRequired("2026-11-26T05:00:00.000Z", 5)).toBe(true);
    expect(plannedRequired("2026-12-01", 0)).toBe(false);
    expect(plannedRequired(null, 5)).toBe(false);
  });

  it("écrit Oui et Non avec qui et quand", () => {
    const now = new Date("2026-11-26T20:00:00Z");
    expect(answerPatch(true, "c1", "note ignorée", now)).toEqual({ not_done: false, not_done_note: null, not_done_by: "c1", not_done_at: now.toISOString() });
    expect(answerPatch(false, "c1", "pas le temps", now)).toEqual({ not_done: true, not_done_note: "pas le temps", not_done_by: "c1", not_done_at: now.toISOString() });
    expect(answerPatch(false, null, "", now).not_done_note).toBeNull();
  });

  it("le rapport journalier suit l'état partagé : aucune contradiction", () => {
    expect(journalOutcome("non", "fait")).toBe("saute");
    expect(journalOutcome("oui", "saute")).toBe("fait");
    expect(journalOutcome("oui", "modifie")).toBe("modifie");
    expect(journalOutcome("oui", undefined)).toBe("fait");
    expect(journalOutcome(null, "modifie")).toBe("modifie");
    expect(journalOutcome(null, undefined)).toBeUndefined();
    expect(outcomeDone("saute")).toBe(false);
    expect(outcomeDone("modifie")).toBe(true);
    expect(outcomeDone("fait")).toBe(true);
  });

  it("titre d'un bloc : le sien, sinon l'exercice, sinon le type", () => {
    const ex = (id: string) => (id === "e1" ? "Rondo" : null);
    expect(blockTitle({ custom_title: " Mon bloc ", exercise_id: "e1", block_type: "Jeu" }, ex)).toBe("Mon bloc");
    expect(blockTitle({ custom_title: null, exercise_id: "e1", block_type: "Jeu" }, ex)).toBe("Rondo");
    expect(blockTitle({ custom_title: null, exercise_id: "e2", block_type: "Jeu" }, ex)).toBe("Jeu");
  });

  it("dit ce qui manque", () => {
    expect(plannedMissingLabel(0)).toBeNull();
    expect(plannedMissingLabel(1)).toBe("exercices prévus : réponds Oui ou Non pour 1 exercice");
    expect(plannedMissingLabel(3)).toBe("exercices prévus : réponds Oui ou Non pour 3 exercices");
  });
});

describe("Rapport complet et exercices prévus", () => {
  const roster = [{ registrationId: "r1", name: "Léa" }];
  const attendance = [{ registration_id: "r1", status: "present", practice_rating: 4, fatigue: 2 }];
  const evaluations = [{ registration_id: "r1", ratings: { "Ball mastery": 4, Prestation: 4, Attitude: 5 }, comment: Array(30).fill("mot").join(" ") }];
  const base = (date: string, planned?: { total: number; answered: number }) =>
    computeReport({ activity: { activity_type: "Pratique", activity_date: date, title: "Filles 2016" }, roster, attendance, evaluations, planned });

  it("pratique passée : les exercices prévus ne bloquent rien", () => {
    const r = base("2026-11-25", { total: 5, answered: 0 });
    expect(r.complete).toBe(true);
    expect(r.plannedMissing).toBe(0);
    expect(reportMissing(r)).toEqual([]);
  });

  it("à partir du 26 nov. : chaque exercice prévu doit avoir sa réponse", () => {
    const r = base("2026-11-26", { total: 5, answered: 3 });
    expect(r.complete).toBe(false);
    expect(r.plannedMissing).toBe(2);
    expect(reportMissing(r)).toContain("exercices prévus : réponds Oui ou Non pour 2 exercices");
    expect(base("2026-11-26", { total: 5, answered: 5 }).complete).toBe(true);
  });

  it("sans plan ou sans données, rien n'est exigé", () => {
    expect(base("2026-11-27", { total: 0, answered: 0 }).complete).toBe(true);
    expect(base("2026-11-27").complete).toBe(true);
  });
});

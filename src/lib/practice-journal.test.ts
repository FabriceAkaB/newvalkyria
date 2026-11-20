import { describe, expect, it } from "vitest";

import { journalProgress, mergeJournal, parseJournalPatch } from "@/lib/practice-journal";

describe("rapport journalier", () => {
  it("garde seulement les champs connus, des échelles de 1 à 5 et des issues valides", () => {
    expect(parseJournalPatch({ temps: 4, inconnu: "x" })).toEqual({ temps: 4 });
    expect(parseJournalPatch({ temps: 9 })).toBeNull();
    expect(parseJournalPatch({ temps_note: "Retard au 2e bloc" })).toEqual({ temps_note: "Retard au 2e bloc" });
    expect(parseJournalPatch({ exercices: { "11111111-1111-4111-8111-111111111111": "saute", bad: "fait" } })).toEqual({ exercices: { "11111111-1111-4111-8111-111111111111": "saute" } });
  });

  it("s'enregistre au fil de la journée sans perdre ce qui est déjà écrit", () => {
    const a = mergeJournal({}, { deroulement: "Bonne énergie", temps: 3 });
    const b = mergeJournal(a, { temps: 5, exercices: { x: "fait" } });
    const c = mergeJournal(b, { exercices: { y: "modifie" }, deroulement: "" });
    expect(c).toEqual({ temps: 5, exercices: { x: "fait", y: "modifie" } });
  });

  it("compte les parties remplies", () => {
    expect(journalProgress({ deroulement: "Bien", temps: 4, exercices: { a: "fait", b: "fait" } }, 2)).toEqual({ done: 3, total: 11 });
    expect(journalProgress({}, 0)).toEqual({ done: 0, total: 10 });
  });
});

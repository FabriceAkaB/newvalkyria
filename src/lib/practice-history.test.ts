import { describe, expect, it } from "vitest";

import { checksOf, cleanDeckUrl, cleanScore, inGallery, isComplete, isLate, missingOf } from "@/lib/practice-history";

const base = { date: "2026-11-02", planned: false, deck: false, present: 0, answered: 0, analysis: false, themeScore: null as number | null };

describe("historique des pratiques", () => {
  it("une pratique passée sans diapos ni plan est en retard", () => {
    expect(isLate(base, "2026-11-03")).toBe(true);
    expect(isLate({ ...base, deck: true }, "2026-11-03")).toBe(false);
    expect(isLate(base, "2026-11-02")).toBe(false);
  });

  it("dit ce qui manque, dans l'ordre", () => {
    expect(missingOf({ ...base, deck: true, present: 12, answered: 10 })).toEqual(["Sondage de fin", "Analyse d'après pratique", "Note de pertinence au thème"]);
    expect(checksOf({ ...base, planned: true, present: 9, answered: 9, analysis: true, themeScore: 9 })).toEqual({ depot: true, presences: true, sondage: true, analyse: true, note: true });
    expect(isComplete({ ...base, planned: true, present: 9, answered: 9, analysis: true, themeScore: 6 })).toBe(true);
  });

  it("accepte seulement un lien https pour les diapos", () => {
    expect(cleanDeckUrl("https://claude.ai/artifact/XhqiEYavWgZEsVYzt1bgCi")).toBe("https://claude.ai/artifact/XhqiEYavWgZEsVYzt1bgCi");
    expect(cleanDeckUrl("")).toBeNull();
    expect(cleanDeckUrl("javascript:alert(1)")).toBeUndefined();
    expect(cleanDeckUrl("pas un lien")).toBeUndefined();
  });

  it("à 8 sur 10 ou plus, la pratique entre dans la galerie", () => {
    expect(inGallery({ themeScore: 8 })).toBe(true);
    expect(inGallery({ themeScore: 7 })).toBe(false);
    expect(inGallery({ themeScore: null })).toBe(false);
    expect(cleanScore("9")).toBe(9);
    expect(cleanScore("")).toBeNull();
    expect(cleanScore(11)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { parseIdea, sortIdeas } from "@/lib/idea-box-core";

describe("Boîte à idées", () => {
  it("accepte une idée et nettoie les champs", () => {
    expect(parseIdea({ message: "  Un tournoi entre groupes à Noël  ", category: "matchs", authorEmail: " Parent@Ex.com " })).toMatchObject({ category: "matchs", message: "Un tournoi entre groupes à Noël", authorEmail: "parent@ex.com" });
  });
  it("refuse une idée trop courte, un courriel invalide et un robot", () => {
    expect(typeof parseIdea({ message: "court" })).toBe("string");
    expect(parseIdea({ message: "Une très bonne idée", authorEmail: "pas-un-courriel" })).toBe("Le courriel n'est pas valide.");
    expect(parseIdea({ message: "Une très bonne idée", site: "http://spam" })).toBe("robot");
  });
  it("une catégorie inconnue devient « autre »", () => {
    expect(parseIdea({ message: "Une très bonne idée", category: "xyz" })).toMatchObject({ category: "autre" });
  });
  it("les nouvelles d'abord, puis les plus récentes", () => {
    const s = sortIdeas([
      { id: 1, status: "realisee", created_at: "2026-11-10" },
      { id: 2, status: "nouvelle", created_at: "2026-11-01" },
      { id: 3, status: "nouvelle", created_at: "2026-11-12" }
    ]);
    expect(s.map((x) => x.id)).toEqual([3, 2, 1]);
  });
});

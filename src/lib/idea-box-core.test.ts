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

describe("délai de réponse aux idées", () => {
  it("en retard après 3 jours sans réponse, sauf si l'idée est close", async () => {
    const { ideaDelay } = await import("@/lib/idea-box-core");
    const now = new Date("2026-11-17T12:00:00Z");
    expect(ideaDelay({ created_at: "2026-11-14T11:00:00Z", responded_at: null, status: "nouvelle" }, now)).toEqual({ days: 3, late: true });
    expect(ideaDelay({ created_at: "2026-11-15T11:00:00Z", responded_at: null, status: "nouvelle" }, now).late).toBe(false);
    expect(ideaDelay({ created_at: "2026-11-01T11:00:00Z", responded_at: "2026-11-02T11:00:00Z", status: "a_l_etude" }, now).late).toBe(false);
    expect(ideaDelay({ created_at: "2026-11-01T11:00:00Z", responded_at: null, status: "non_retenue" }, now).late).toBe(false);
  });
});

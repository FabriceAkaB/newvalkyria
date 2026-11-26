import { describe, expect, it } from "vitest";

import { bestExercises, bookChapters, bookExercises, bookPages, chapterStarts, matchesGrid, pageOfExercise, spreadStart, turnPage, type BookSource } from "@/lib/exercise-book-core";

const ex = (id: string, o: Partial<BookSource> = {}, bank: Partial<BookSource["bank"]> = {}): BookSource => ({
  id, title: `Exercice ${id}`, category: "Passe", exercise_type: "jeu-reduit", session_place: null, level: null, age_groups: ["U10"], venue: null,
  min_players: 6, max_players: 12, duration_minutes: 12, dimensions: null, objective: null, instructions: null, coaching_points: null,
  setup_5_7: null, setup_8_10: "  ", setup_11_16: "Deux carrés", variant_easier: null, variant_harder: null, variant_cognitive: null, variants: null,
  progression: null, common_mistakes: null, material: null, image_url: null, video_url: null, diagram_data: null,
  ...o,
  bank: { status: "a-tester", top: false, average: null, count: 0, ...bank }
});

describe("Bible : exercices", () => {
  it("retire les exercices retirés, garde tout le reste, et met « Autre » sans thème", () => {
    const list = bookExercises([ex("a"), ex("b", {}, { status: "retire" }), ex("c", { category: null }), ex("d", {}, { status: "a-changer" })]);
    expect(list.map((e) => e.id)).toEqual(["a", "c", "d"]);
    expect(list[1].chapter).toBe("Autre");
    expect(list[0].players).toBe("6 à 12 joueuses");
    expect(list[0].setups).toEqual([{ label: "11 à 16 joueuses", text: "Deux carrés" }]);
  });

  it("ne garde un schéma que s'il a des éléments", () => {
    const [a, b] = bookExercises([ex("a", { diagram_data: { elements: [], arrows: [] } }), ex("b", { diagram_data: { elements: [{ id: "1", type: "cone", x: 1, y: 1 }], arrows: [] } })]);
    expect(a.diagram).toBeNull();
    expect(b.diagram?.elements).toHaveLength(1);
  });
});

describe("Bible : chapitres", () => {
  const list = bookExercises([
    ex("p1", { category: "Passe", exercise_type: "forme-jouee", title: "Zèbre" }),
    ex("p2", { category: "Passe", exercise_type: "jeu-reduit", title: "Alpha" }),
    ex("p3", { category: "Passe", exercise_type: "jeu-reduit", title: "Bravo" }, { status: "approuve", average: 9 }),
    ex("b1", { category: "Ball mastery", exercise_type: "ball-mastery" }),
    ex("o1", { category: null }),
    ex("x1", { category: "défense" })
  ]);
  const chapters = bookChapters(list);

  it("un chapitre par thème, dans l'ordre de la banque, « Autre » à la fin", () => {
    expect(chapters.map((c) => c.title)).toEqual(["Ball mastery", "Passe", "Défense", "Autre"]);
    expect(chapters.map((c) => c.number)).toEqual([1, 2, 3, 4]);
  });

  it("dans un chapitre : par catégorie dans l'ordre de la séance, les approuvés d'abord", () => {
    const passe = chapters.find((c) => c.key === "Passe")!;
    expect(passe.exercises.map((e) => e.id)).toEqual(["p3", "p2", "p1"]);
    expect(passe.approved).toBe(1);
    expect(passe.types).toEqual(["Jeu réduit à thème", "Forme jouée"]);
  });

  it("les meilleurs : approuvés seulement, top puis note", () => {
    const best = bestExercises(bookExercises([ex("a", {}, { status: "approuve", average: 8.5 }), ex("b", {}, { status: "approuve", average: 9.5, top: true }), ex("c", {}, { status: "a-tester", average: 10 })]));
    expect(best.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("pages : couverture, sommaire, ouverture de chapitre puis une page par exercice", () => {
    const pages = bookPages(chapters);
    expect(pages.slice(0, 4).map((p) => p.kind)).toEqual(["cover", "contents", "chapter", "exercise"]);
    expect(pages).toHaveLength(2 + chapters.length + list.length);
    expect(pages.every((p, i) => p.number === i)).toBe(true);
    const starts = chapterStarts(pages);
    expect(starts.get("Ball mastery")).toBe(2);
    expect(starts.get("Passe")).toBe(4);
    expect(pageOfExercise(pages, "p3")).toBe(5);
  });
});

describe("Bible : feuilleter", () => {
  it("double page : couverture seule, puis 1-2, 3-4…", () => {
    expect(spreadStart(0, true)).toBe(0);
    expect(spreadStart(1, true)).toBe(1);
    expect(spreadStart(2, true)).toBe(1);
    expect(spreadStart(4, true)).toBe(3);
    expect(spreadStart(4, false)).toBe(4);
  });

  it("tourne la page sans sortir du livre", () => {
    expect(turnPage(0, 1, true, 10)).toBe(1);
    expect(turnPage(2, 1, true, 10)).toBe(3);
    expect(turnPage(9, 1, true, 10)).toBe(9);
    expect(turnPage(2, -1, true, 10)).toBe(0);
    expect(turnPage(5, -1, true, 10)).toBe(3);
    expect(turnPage(0, -1, false, 10)).toBe(0);
    expect(turnPage(9, 1, false, 10)).toBe(9);
    expect(turnPage(3, 1, false, 10)).toBe(4);
  });
});

describe("Bible : grille", () => {
  const [a] = bookExercises([ex("a", { title: "Rondo des passes", category: "Passe", age_groups: ["U12"] }, { status: "approuve" })]);
  it("cherche sans accents dans le titre, le thème et l'âge", () => {
    expect(matchesGrid(a, { q: "rondo u12" })).toBe(true);
    expect(matchesGrid(a, { q: "défense" })).toBe(false);
    expect(matchesGrid(a, { chapter: "Passe", best: true })).toBe(true);
    expect(matchesGrid(a, { chapter: "Finition" })).toBe(false);
  });
});

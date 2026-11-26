import { describe, expect, it } from "vitest";

import { bestExercises, bookChapters, bookExercises, bookPages, chapterStarts, duplicateGroups, jpReferenceExercises, matchesGrid, pageOfExercise, spreadStart, turnPage, type BookSource } from "@/lib/exercise-book-core";

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

describe("Bible : chaque exercice une seule fois", () => {
  it("même diapo = un seul exercice à l'écran, les autres deviennent ses versions", () => {
    const list = bookExercises([
      ex("a", { image_hash: "h1", title: "Rondo 4c1 : passe qui traverse", category: "Passe", created_at: "2026-11-16T10:00:00Z" }),
      ex("b", { image_hash: "h1", title: "Rondo 4c1 : perdu, presse !", category: "Prise de décision", instructions: "Perdu : presse.", created_at: "2026-11-16T09:00:00Z" }, { count: 2 }),
      ex("c", { image_hash: "h2", title: "Autre" })
    ]);
    expect(list.map((e) => e.id)).toEqual(["b", "c"]);
    expect(list[0].versions).toEqual([{ id: "a", title: "Rondo 4c1 : passe qui traverse", chapter: "Passe", type: "Jeu réduit à thème", instructions: null, coachingPoints: null }]);
    expect(list[1].versions).toEqual([]);
  });

  it("même titre (accents, majuscules, ponctuation ignorés) = doublon ; sans note, le plus ancien reste", () => {
    const list = bookExercises([
      ex("x", { title: "Jeu — le capital points", created_at: "2026-11-20T00:00:00Z" }),
      ex("y", { title: "jeu : LE CAPITAL  points", created_at: "2026-11-01T00:00:00Z" })
    ]);
    expect(list.map((e) => e.id)).toEqual(["y"]);
    expect(list[0].versions.map((v) => v.id)).toEqual(["x"]);
  });

  it("un exercice retiré ne compte pas, et la recherche trouve aussi les versions", () => {
    const list = bookExercises([ex("a", { image_hash: "h" }), ex("b", { image_hash: "h", title: "Toro spécial", category: "Défense" }, { status: "retire" })]);
    expect(list).toHaveLength(1);
    expect(list[0].versions).toEqual([]);
    const [m] = bookExercises([ex("a", { image_hash: "h" }), ex("b", { image_hash: "h", title: "Toro spécial", category: "Défense", created_at: "2027-01-01" })]);
    expect(matchesGrid(m, { q: "toro" })).toBe(true);
    expect(matchesGrid(m, { chapter: "Défense" })).toBe(true);
    expect(matchesGrid(m, { chapter: "Finition" })).toBe(false);
  });

  it("regroupe en chaîne (diapo commune puis titre commun)", () => {
    const g = duplicateGroups([
      { id: "1", title: "A", image_hash: "h" },
      { id: "2", title: "B", image_hash: "h" },
      { id: "3", title: "b", image_hash: null },
      { id: "4", title: "C", image_hash: null }
    ]);
    expect(g.map((x) => x.map((e) => e.id))).toEqual([["1", "2", "3"], ["4"]]);
  });
});

describe("Bible : exercices JP référence", () => {
  const ref = (id: string, o: Partial<BookSource> = {}, bank: Partial<BookSource["bank"]> = {}) => ex(id, { jp_reference_at: "2026-11-26T12:00:00Z", ...o }, bank);

  it("seulement les exercices marqués par JP, par thème puis par titre, avec « le meilleur pour »", () => {
    const list = bookExercises([
      ref("f", { category: "Finition", title: "Bravo", jp_reference_note: "  la frappe en 1 touche  " }),
      ex("x", { category: "Passe" }, { status: "approuve", average: 10 }),
      ref("p", { category: "Passe", title: "Zèbre" }),
      ref("b", { category: "Ball mastery", title: "Alpha" })
    ]);
    const refs = jpReferenceExercises(list);
    expect(refs.map((e) => e.id)).toEqual(["b", "p", "f"]);
    expect(refs[2].jpReferenceNote).toBe("la frappe en 1 touche");
    expect(list.find((e) => e.id === "x")?.jpReference).toBe(false);
  });

  it("une note sans marqueur ne compte pas ; le marqueur passe devant les approuvés dans un chapitre", () => {
    const list = bookExercises([ex("a", { jp_reference_note: "oublié" }, { status: "approuve", average: 9 }), ref("b")]);
    expect(list.find((e) => e.id === "a")?.jpReferenceNote).toBeNull();
    expect(bookChapters(list)[0].exercises.map((e) => e.id)).toEqual(["b", "a"]);
  });

  it("dans un groupe de doublons, l'exercice gardé est celui que JP a marqué", () => {
    const list = bookExercises([ex("a", { title: "Rondo" }, { status: "approuve", average: 9 }), ref("b", { title: "rondo" })]);
    expect(list.map((e) => e.id)).toEqual(["b"]);
    expect(list[0].versions.map((v) => v.id)).toEqual(["a"]);
  });

  it("filtre et recherche de la grille", () => {
    const [a, b] = bookExercises([ref("a", { title: "Un", jp_reference_note: "la passe qui traverse" }), ex("b", { title: "Deux" })]);
    expect(matchesGrid(a, { jp: true })).toBe(true);
    expect(matchesGrid(b, { jp: true })).toBe(false);
    expect(matchesGrid(a, { q: "traverse" })).toBe(true);
  });
});

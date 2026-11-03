import { describe, expect, it } from "vitest";

import { gallerySlides, matchesSlide, toSlide } from "@/lib/exercise-gallery";
import type { BankEntry } from "@/lib/exercises-repo";

const entry = (id: string, status: string, extra: Partial<BankEntry> = {}): BankEntry =>
  ({
    id,
    title: `Exercice ${id}`,
    exercise_type: "jeu-reduit",
    session_place: "forme-jouee",
    venue: "gymnase",
    min_players: 8,
    max_players: 10,
    duration_minutes: 15,
    age_groups: ["U9", "U10"],
    category: "1v1",
    image_url: null,
    video_url: null,
    diagram_data: { elements: [], arrows: [] },
    setup_5_7: null,
    setup_8_10: "Deux carrés de 15 m",
    setup_11_16: "  ",
    bank: { status, top: false, average: 8.5 },
    ...extra
  }) as unknown as BankEntry;

describe("galerie des exercices", () => {
  it("garde seulement les approuvés, ou tous sauf les retirés", () => {
    const list = [entry("a", "approuve"), entry("b", "a-tester"), entry("c", "retire")];
    expect(gallerySlides(list).map((s) => s.id)).toEqual(["a"]);
    expect(gallerySlides(list, { all: true }).map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("une diapo montre l'essentiel en étiquettes et l'organisation remplie seulement", () => {
    const s = toSlide(entry("a", "approuve"));
    expect(s.tags).toEqual(["Jeu réduit à thème", "Forme jouée", "Gymnase", "8 à 10 joueuses", "15 min"]);
    expect(s.setup).toEqual([{ label: "8 à 10 joueuses", text: "Deux carrés de 15 m" }]);
    expect(s.diagram).toBeNull();
  });

  it("filtre par âge et par thème", () => {
    const s = toSlide(entry("a", "approuve"));
    expect(matchesSlide(s, { age: "U9", theme: "" })).toBe(true);
    expect(matchesSlide(s, { age: "U12", theme: "" })).toBe(false);
    expect(matchesSlide(s, { age: "", theme: "1V1" })).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { addSeen, blockKey, deckKey, practiceReadItems, practiceReadStatus, readLabel } from "@/lib/practice-read";

const items = practiceReadItems({
  decks: [{ id: "d1", fileName: "Jeu à 2.pdf" }],
  blocks: [
    { id: "b1", title: "Ball mastery" },
    { id: "b2", title: "Rondo 4 c. 2" }
  ]
});

describe("prise de connaissance de la pratique", () => {
  it("liste les diapos puis chaque exercice", () => {
    expect(items.map((i) => i.key)).toEqual([deckKey("d1"), blockKey("b1"), blockKey("b2")]);
    expect(items[0].label).toBe("Diapos : Jeu à 2");
    expect(items[2].label).toBe("Exercice 2 : Rondo 4 c. 2");
  });

  it("ne permet de confirmer qu'une fois tout vu", () => {
    const partial = practiceReadStatus(items, [deckKey("d1")], null);
    expect(partial).toMatchObject({ total: 3, seen: 1, canConfirm: false, confirmed: false });
    expect(partial.missing.map((m) => m.key)).toEqual([blockKey("b1"), blockKey("b2")]);
    expect(practiceReadStatus(items, [deckKey("d1"), blockKey("b1"), blockKey("b2")], null).canConfirm).toBe(true);
  });

  it("rien à lire : pas de confirmation possible", () => {
    expect(practiceReadStatus([], [], null)).toMatchObject({ hasContent: false, canConfirm: false });
  });

  it("ajoute un élément vu sans doublon", () => {
    expect(addSeen(["a"], "a")).toEqual(["a"]);
    expect(addSeen(null, "a")).toEqual(["a"]);
    expect(addSeen(["a", 3], "b")).toEqual(["a", "b"]);
  });

  it("libellé pour JP", () => {
    expect(readLabel({ total: 3, seen: 0, confirmed: false }, null)).toBe("Pratique pas encore ouverte");
    expect(readLabel({ total: 3, seen: 2, confirmed: false }, null)).toBe("Pratique en lecture : 2/3 vus");
    expect(readLabel({ total: 3, seen: 3, confirmed: true }, "2026-11-16T23:02:00Z")).toMatch(/^Pratique lue le 16 nov\. à 18 h 02$/);
  });
});

import { describe, expect, it } from "vitest";

import { groupByMonth, kindsLine, palmaresSummary, sortTitles, timesLabel } from "@/lib/champion-titles";

const t = (date: string, createdAt: string, kind: "individuel" | "groupe" | "attitude" | "special" = "individuel", points = 10) => ({ date, createdAt, kind, points });

describe("palmarès d'une fille", () => {
  it("la plus récente en haut, puis l'heure de publication le même jour", () => {
    const out = sortTitles([t("2026-11-02", "2026-11-02T20:00:00Z"), t("2026-11-20", "2026-11-20T19:00:00Z"), t("2026-11-20", "2026-11-20T21:00:00Z")]);
    expect(out.map((x) => x.createdAt)).toEqual(["2026-11-20T21:00:00Z", "2026-11-20T19:00:00Z", "2026-11-02T20:00:00Z"]);
  });

  it("compteur en mots", () => {
    expect(timesLabel(0)).toBe("Pas encore championne");
    expect(timesLabel(1)).toBe("1 fois championne");
    expect(timesLabel(5)).toBe("5 fois championne");
  });

  it("résumé : total, points, catégories dans l'ordre, dernier titre", () => {
    const s = palmaresSummary([t("2026-11-02", "", "attitude", 10), t("2026-11-20", "", "individuel", 10), t("2026-10-12", "", "groupe", 5), t("2026-11-05", "", "individuel", 10)]);
    expect(s.total).toBe(4);
    expect(s.points).toBe(35);
    expect(s.last).toBe("2026-11-20");
    expect(s.byKind.map((k) => [k.kind, k.count])).toEqual([["individuel", 2], ["groupe", 1], ["attitude", 1]]);
    expect(kindsLine(s.byKind)).toBe("2 fois gagnante · 1 fois en groupe gagnant · 1 fois pour l'attitude");
    expect(palmaresSummary([])).toEqual({ total: 0, points: 0, byKind: [], last: null });
  });

  it("regroupe par mois, le plus récent en haut", () => {
    const g = groupByMonth([t("2026-10-12", "a"), t("2026-11-20", "b"), t("2026-11-02", "c"), t("2027-01-08", "d")]);
    expect(g.map((m) => m.label)).toEqual(["Janvier 2027", "Novembre 2026", "Octobre 2026"]);
    expect(g[1].items.map((x) => x.date)).toEqual(["2026-11-20", "2026-11-02"]);
  });
});

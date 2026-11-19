import { describe, expect, it } from "vitest";

import { beforeAfter, checkpointsFor, checkpointWindow, currentCheckpoint } from "@/lib/progress-videos";

const season = { starts_on: "2026-09-01", ends_on: "2027-04-18" };

describe("progression en vidéo", () => {
  it("début, mi et fin pour les petites ; mi et fin pour les 2015 et plus vieilles", () => {
    expect(checkpointsFor("2016")).toEqual(["debut", "mi", "fin"]);
    expect(checkpointsFor("2017")).toEqual(["debut", "mi", "fin"]);
    expect(checkpointsFor("2015")).toEqual(["mi", "fin"]);
    expect(checkpointsFor("2014-2013")).toEqual(["mi", "fin"]);
  });

  it("dit quand filmer chaque moment", () => {
    expect(checkpointWindow(season, "debut")).toEqual({ from: "2026-09-01", to: "2026-10-13" });
    expect(checkpointWindow(season, "mi")).toEqual({ from: "2026-12-01", to: "2026-12-20" });
    expect(checkpointWindow(season, "fin")).toEqual({ from: "2027-03-28", to: "2027-04-18" });
    expect(currentCheckpoint(season, "2026-11-19")).toBe("mi");
    expect(currentCheckpoint(season, "2027-02-01")).toBe("fin");
  });

  it("montre un avant / après dès deux moments différents", () => {
    expect(beforeAfter([{ checkpoint: "mi", createdAt: "2026-12-10" }])).toBeNull();
    const r = beforeAfter([{ checkpoint: "fin", createdAt: "2027-04-10" }, { checkpoint: "debut", createdAt: "2026-09-20" }, { checkpoint: "mi", createdAt: "2026-12-10" }]);
    expect(r?.before.checkpoint).toBe("debut");
    expect(r?.after.checkpoint).toBe("fin");
  });
});

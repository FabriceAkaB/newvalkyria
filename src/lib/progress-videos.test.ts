import { describe, expect, it } from "vitest";

import { beforeAfter, checkpointsFor, checkpointWindow, currentCheckpoint, defaultCheckpointFor, groupByDay, isVideoRequestActivity, parseCheckpoint, pickRequestDay, requestStatus, summarizeRequest, summaryLabel, videoRequestTask } from "@/lib/progress-videos";

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

  it("l'avant / après ignore les vidéos sans étape", () => {
    expect(beforeAfter([{ checkpoint: null, createdAt: "2026-11-26" }, { checkpoint: "mi", createdAt: "2026-12-10" }])).toBeNull();
    expect(parseCheckpoint("autre")).toBeNull();
    expect(parseCheckpoint("mi")).toBe("mi");
  });

  it("demande de vidéos : seulement les pratiques de filles de l'Académie dès le 26 novembre", () => {
    const base = { activity_date: "2026-11-26", activity_type: "Pratique", organization: null, title: "Filles 2016-2017" };
    expect(isVideoRequestActivity({ ...base, category: "Filles 2016-2017" })).toBe(true);
    expect(isVideoRequestActivity({ ...base, category: "Équipe 2015 AV" })).toBe(true);
    expect(isVideoRequestActivity({ ...base, activity_date: "2026-11-25", category: "Filles 2016-2017" })).toBe(false);
    expect(isVideoRequestActivity({ ...base, category: "Programme intensif garçons 2015", title: "Programme intensif garçons 2015" })).toBe(false);
    expect(isVideoRequestActivity({ ...base, category: "Cadet D4 St-Gabriel", organization: "Saint-Gabriel" })).toBe(false);
    expect(isVideoRequestActivity({ ...base, category: "Filles 2016-2017", activity_type: "Match" })).toBe(false);
  });

  it("absente : marquée à la main ou par MonClubSportif, réversible ; une vidéo l'emporte", () => {
    expect(requestStatus({ videos: 0, mark: null, mcsStatus: null })).toBe("a-filmer");
    expect(requestStatus({ videos: 0, mark: null, mcsStatus: "absent" })).toBe("absente");
    expect(requestStatus({ videos: 0, mark: "presente", mcsStatus: "absent" })).toBe("a-filmer");
    expect(requestStatus({ videos: 0, mark: "absente", mcsStatus: "present" })).toBe("absente");
    expect(requestStatus({ videos: 2, mark: "absente", mcsStatus: "absent" })).toBe("filmee");
  });

  it("progression de la journée et tâche de JP", () => {
    const s = summarizeRequest([...Array(12).fill("filmee"), "absente", "absente", "a-filmer", "a-filmer", "a-filmer"]);
    expect(s).toEqual({ total: 17, filmed: 12, absent: 2, remaining: 3, done: false });
    expect(summaryLabel(s)).toBe("12 sur 15 filmées, 2 absentes");
    const t = videoRequestTask("2026-11-26", s, ["Filles 2016-2017"])!;
    expect(t.ref).toBe("videos-progression:2026-11-26");
    expect(t.title).toContain("3 filles sans vidéo");
    expect(t.done).toBe(false);
    expect(videoRequestTask("2026-11-26", summarizeRequest(["filmee", "absente"]), [])!.done).toBe(true);
    expect(videoRequestTask("2026-11-26", summarizeRequest([]), [])).toBeNull();
  });

  it("étape proposée selon la période et l'âge", () => {
    expect(defaultCheckpointFor(season, "2026-11-26", "2016")).toBeNull();
    expect(defaultCheckpointFor(season, "2026-12-05", "2015")).toBe("mi");
    expect(defaultCheckpointFor(season, "2026-09-10", "2014")).toBeNull();
    expect(defaultCheckpointFor(season, "2026-09-10", "2017")).toBe("debut");
  });

  it("choisit le jour à ouvrir et range les vidéos par jour", () => {
    const days = ["2026-11-26", "2026-11-30", "2026-12-02"];
    expect(pickRequestDay(days, "2026-11-25")).toBe("2026-11-26");
    expect(pickRequestDay(days, "2026-11-27")).toBe("2026-11-30");
    expect(pickRequestDay(days, "2026-12-10")).toBe("2026-12-02");
    expect(pickRequestDay(days, "2026-12-10", "2026-11-26")).toBe("2026-11-26");
    expect(pickRequestDay([], "2026-12-10")).toBeNull();
    const g = groupByDay([{ filmedOn: "2026-11-26", createdAt: "2026-11-26T23:00:00Z" }, { filmedOn: null, createdAt: "2026-11-30T20:00:00Z" }, { filmedOn: "2026-11-26", createdAt: "2026-11-26T22:00:00Z" }]);
    expect(g.map((x) => x.day)).toEqual(["2026-11-30", "2026-11-26"]);
    expect(g[1].videos[0].createdAt).toBe("2026-11-26T22:00:00Z");
  });
});

import { describe, expect, it } from "vitest";

import { canWatch, classifyRecording, clock, durationLabel, highlightCounts, highlightsFromVeo, isNewvalRecording, montrealParts, periodsFromVeo, type VideoCandidate } from "@/lib/match-videos-core";

const video = { kind: "match", team_id: "t1", participant_keys: ["sophie anne bergeron"], published: true, status: "pret" };

describe("canWatch", () => {
  it("équipe de la joueuse", () => expect(canWatch(video, { keys: ["x"], teamIds: ["t1"] })).toBe(true));
  it("joueuse invitée présente au match", () => expect(canWatch(video, { keys: ["sophie anne bergeron"], teamIds: ["t9"] })).toBe(true));
  it("autre famille", () => expect(canWatch(video, { keys: ["y"], teamIds: ["t2"] })).toBe(false));
  it("pratique, retirée ou à classer : jamais aux familles", () => {
    expect(canWatch({ ...video, kind: "pratique" }, { keys: [], teamIds: ["t1"] })).toBe(false);
    expect(canWatch({ ...video, published: false }, { keys: [], teamIds: ["t1"] })).toBe(false);
    expect(canWatch({ ...video, status: "a-classer" }, { keys: [], teamIds: ["t1"] })).toBe(false);
  });
});

describe("affichage", () => {
  it("durée et instant", () => {
    expect(durationLabel(5520)).toBe("1 h 32");
    expect(durationLabel(1500)).toBe("25 min");
    expect(durationLabel(null)).toBe("");
    expect(clock(6627)).toBe("1:50:27");
    expect(clock(724)).toBe("12:04");
  });
});

describe("données Veo", () => {
  it("périodes en ordre et nommées", () => {
    const p = periodsFromVeo([{ timeframe: [3885, 5400], name: "" }, { timeframe: [1278, 1680], name: "" }, { timeframe: [10, 5] }]);
    expect(p).toEqual([
      { from: 1278, to: 1680, label: "1re période" },
      { from: 3885, to: 5400, label: "2e période" }
    ]);
  });
  it("temps forts triés, doublons fusionnés, libellés en français", () => {
    const h = highlightsFromVeo([
      { start: 6627, duration: 25, type: "goal", is_ai_generated: true, tags: [{ name: "But", slug: "goal" }] },
      { start: 6620, duration: 25, type: "goal", is_ai_generated: true },
      { start: 6612, duration: 25, type: "shot_on_goal", tags: [{ name: "Tir au but", slug: "shot-on-goal" }] },
      { start: 100, duration: 20, type: "custom_x", tags: [{ name: "Belle passe" }] }
    ]);
    expect(h.map((x) => [x.t, x.label])).toEqual([
      [100, "Belle passe"],
      [6612, "Tir cadré"],
      [6620, "But"]
    ]);
    expect(highlightCounts(h).map((c) => `${c.n} ${c.label}`)).toEqual(["1 But", "1 Tir cadré", "1 Belle passe"]);
  });
});

describe("enregistrements Veo", () => {
  const c = (o: Partial<VideoCandidate>): VideoCandidate => ({ kind: "match", teamId: "t", teamName: "Équipe 2015 AV", mcsEventId: 1, activityId: null, title: "Match", startMin: null, ...o });
  it("seulement les titres Newval", () => {
    expect(isNewvalRecording("Newval 2015 AV match")).toBe(true);
    expect(isNewvalRecording("New valkyria 2016")).toBe(true);
    expect(isNewvalRecording("Match Nov 1, 2026")).toBe(false);
    expect(isNewvalRecording("2015F Révolution")).toBe(false);
  });
  it("heure de Montréal", () => expect(montrealParts("2026-11-01T22:30:19+01:00")).toEqual({ date: "2026-11-01", startMin: 16 * 60 + 30 }));
  it("l'heure la plus proche gagne", () => {
    const r = classifyRecording({ title: "Newval", startMin: 16 * 60 + 25 }, [c({ teamName: "Équipe 2015 INT", kind: "pratique", startMin: 16 * 60 + 30 }), c({ teamName: "Équipe 2015 INT", startMin: 17 * 60 + 30 })]);
    expect(r.candidate?.kind).toBe("pratique");
  });
  it("le titre départage (match, équipe)", () => {
    const list = [c({ teamName: "Équipe 2015 AV", teamId: "av" }), c({ teamName: "Équipe 2015 INT", teamId: "int" })];
    expect(classifyRecording({ title: "Newval 2015 INT", startMin: null }, list).candidate?.teamId).toBe("int");
    expect(classifyRecording({ title: "Newval", startMin: null }, list).candidate).toBeNull();
    expect(classifyRecording({ title: "Newval pratique", startMin: null }, list).reason).toContain("Aucune activité");
  });
  it("trop loin dans le temps", () => expect(classifyRecording({ title: "Newval", startMin: 9 * 60 }, [c({ startMin: 16 * 60 })]).candidate).toBeNull());
});

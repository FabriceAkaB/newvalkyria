import { describe, expect, it } from "vitest";

import { canPublish, canWatch, classifyRecording, durationLabel, isNewvalRecording, montrealParts, streamHostOf, summarizeConsent, type VideoCandidate } from "@/lib/match-videos-core";

const video = { team_id: "t1", participant_keys: ["sophie anne bergeron"], published: true, status: "pret" };

describe("canWatch", () => {
  it("équipe de la joueuse", () => expect(canWatch(video, { keys: ["x"], teamIds: ["t1"] })).toBe(true));
  it("joueuse invitée présente au match", () => expect(canWatch(video, { keys: ["sophie anne bergeron"], teamIds: ["t9"] })).toBe(true));
  it("autre famille", () => expect(canWatch(video, { keys: ["y"], teamIds: ["t2"] })).toBe(false));
  it("pas publiée ou pas prête", () => {
    expect(canWatch({ ...video, published: false }, { keys: [], teamIds: ["t1"] })).toBe(false);
    expect(canWatch({ ...video, status: "traitement" }, { keys: [], teamIds: ["t1"] })).toBe(false);
  });
});

describe("accord photo et vidéo", () => {
  const c = summarizeConsent([
    { name: "Béa", state: "oui" },
    { name: "Ana", state: "non" },
    { name: "Zoé", state: "sans-reponse" }
  ]);
  it("résume", () => expect(c).toEqual({ oui: ["Béa"], non: ["Ana"], sansReponse: ["Zoé"] }));
  it("bloque sans confirmation", () => {
    const r = canPublish(c, false);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("1 refus (Ana)");
    expect(r.reason).toContain("1 sans réponse");
  });
  it("permet avec confirmation ou si tout le monde a dit oui", () => {
    expect(canPublish(c, true).ok).toBe(true);
    expect(canPublish({ oui: ["A"], non: [], sansReponse: [] }, false).ok).toBe(true);
  });
});

describe("affichage", () => {
  it("durée", () => {
    expect(durationLabel(5520)).toBe("1 h 32");
    expect(durationLabel(1500)).toBe("25 min");
    expect(durationLabel(null)).toBe("");
  });
  it("hôte du lecteur", () => {
    expect(streamHostOf("https://customer-abc123.cloudflarestream.com/uid/manifest/video.m3u8")).toBe("customer-abc123.cloudflarestream.com");
    expect(streamHostOf("https://exemple.com/x")).toBeNull();
  });
});

describe("enregistrements Veo", () => {
  const c = (o: Partial<VideoCandidate>): VideoCandidate => ({ kind: "match", teamId: "t", teamName: "Équipe 2015 AV", mcsEventId: 1, activityId: null, title: "Match", startMin: null, ...o });
  it("seulement les titres Newval", () => {
    expect(isNewvalRecording("Newval 2015 AV match")).toBe(true);
    expect(isNewvalRecording("NEW VAL pratique")).toBe(true);
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

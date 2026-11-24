import { describe, expect, it } from "vitest";

import { CAMERA_KIT, canFeature, clipCount, CTA, FORMATS, formatOf, isBoysGroup, missingShotsForFormat, PRACTICE_MOMENTS, PRACTICE_SHOTS, SHOOT_RULES, SHOT_TYPES, shotListFor } from "@/lib/shooting-guide-core";

describe("guide de tournage", () => {
  it("a les 9 types de plans demandés par JP", () => {
    expect(SHOT_TYPES.map((s) => s.id)).toEqual(["large", "moyen", "serre", "pieds", "ralenti", "pov", "reaction", "entrevue", "ambiance"]);
    for (const s of SHOT_TYPES) expect(s.what && s.use && s.how && s.avoid && s.seconds > 0).toBeTruthy();
  });

  it("chaque plan de la liste et chaque recette pointe vers un type de plan et un format qui existent", () => {
    const shots = new Set(SHOT_TYPES.map((s) => s.id));
    const formats = new Set(FORMATS.map((f) => f.id));
    const moments = new Set(PRACTICE_MOMENTS.map((m) => m.id));
    for (const p of PRACTICE_SHOTS) {
      expect(shots.has(p.shot)).toBe(true);
      expect(moments.has(p.moment)).toBe(true);
      for (const f of p.formats) expect(formats.has(f)).toBe(true);
    }
    for (const f of FORMATS) for (const s of f.shots) expect(shots.has(s)).toBe(true);
    expect(new Set(PRACTICE_SHOTS.map((p) => p.key)).size).toBe(PRACTICE_SHOTS.length);
  });

  it("a les 5 recettes de format, chacune finit par l'appel à l'action", () => {
    expect(FORMATS.map((f) => f.id)).toEqual(["reel30", "carrousel", "entrevue", "avant_apres", "lab"]);
    for (const id of ["reel30", "carrousel", "avant_apres", "lab"] as const) expect(formatOf(id).steps.at(-1)!.what).toContain(CTA);
  });

  it("la liste du jour : 360° seulement en gymnase, Lab et entrevue seulement s'ils sont prévus", () => {
    const base = shotListFor({ gym: false });
    expect(base.some((s) => s.key === "bm-360")).toBe(false);
    expect(base.some((s) => s.moment === "lab" || s.moment === "entrevue")).toBe(false);
    const full = shotListFor({ gym: true, labBlocks: 2, interview: true });
    expect(full.some((s) => s.key === "bm-360")).toBe(true);
    expect(full.some((s) => s.moment === "lab")).toBe(true);
    expect(full.some((s) => s.moment === "entrevue")).toBe(true);
    expect(clipCount(full)).toBeGreaterThan(clipCount(base));
  });

  it("dit les plans qui manquent pour monter un format", () => {
    expect(missingShotsForFormat("avant_apres", ["pieds"])).toEqual(["moyen", "ralenti"]);
    expect(missingShotsForFormat("reel30", ["ralenti", "large", "moyen", "pieds", "reaction"])).toEqual([]);
  });

  it("jamais les garçons, visage seulement avec le consentement photo", () => {
    expect(canFeature({ boysGroup: true, imageConsent: true, recognizable: false }).ok).toBe(false);
    expect(canFeature({ boysGroup: false, imageConsent: false, recognizable: true }).ok).toBe(false);
    expect(canFeature({ boysGroup: false, imageConsent: null, recognizable: true }).ok).toBe(false);
    expect(canFeature({ boysGroup: false, imageConsent: false, recognizable: false }).ok).toBe(true);
    expect(canFeature({ boysGroup: false, imageConsent: true, recognizable: true }).ok).toBe(true);
    expect(isBoysGroup("Garçons 2015 samedi")).toBe(true);
    expect(isBoysGroup("2016-2017 AV")).toBe(false);
    expect(SHOOT_RULES.filter((r) => r.strict).map((r) => r.title)).toContain("Jamais les garçons");
  });

  it("aucun tiret cadratin dans les textes", () => {
    const all = JSON.stringify([SHOT_TYPES, PRACTICE_SHOTS, FORMATS, SHOOT_RULES, CAMERA_KIT]);
    expect(all).not.toMatch(/—/);
  });
});

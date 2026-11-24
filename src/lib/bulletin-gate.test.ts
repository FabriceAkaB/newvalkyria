import { describe, expect, it } from "vitest";

import { GATE_IDS, GATE_QUESTIONS, gateKey, hasEarlyAccess, needsGate, reviewDraft, showGoogleButton } from "@/lib/bulletin-gate";

describe("sondage avant le bulletin", () => {
  it("bloque le bulletin remis tant que le parent n'a pas répondu", () => {
    expect(needsGate({ released: true, surveyStatus: "envoye", respondedAt: null })).toBe(true);
    expect(needsGate({ released: true, surveyStatus: "brouillon", respondedAt: null })).toBe(true);
  });

  it("ouvre le bulletin directement à qui a déjà répondu", () => {
    expect(needsGate({ released: true, surveyStatus: "envoye", respondedAt: "2026-12-15T12:00:00Z" })).toBe(false);
  });

  it("ne bloque jamais un bulletin pas encore remis, ni un sondage fermé ou introuvable", () => {
    expect(needsGate({ released: false, surveyStatus: "envoye", respondedAt: null })).toBe(false);
    expect(needsGate({ released: true, surveyStatus: "ferme", respondedAt: null })).toBe(false);
    expect(needsGate({ released: true, surveyStatus: null, respondedAt: null })).toBe(false);
  });

  it("une clé par saison et par bulletin", () => {
    expect(gateKey("automne-hiver-2026", "mi-saison")).toBe("automne-hiver-2026:mi-saison");
  });

  it("la note de recommandation est obligatoire et nourrit l'indicateur", () => {
    const q = GATE_QUESTIONS.find((x) => x.id === GATE_IDS.recommend);
    expect(q).toMatchObject({ type: "note10", role: "recommandation", required: true });
    expect(new Set(GATE_QUESTIONS.map((x) => x.id)).size).toBe(GATE_QUESTIONS.length);
    for (const x of GATE_QUESTIONS) expect(x.id).toMatch(/^[a-z0-9_-]{1,40}$/);
  });
});

describe("bouton d'avis Google", () => {
  const url = "https://search.google.com/local/writereview?placeid=abc";
  it("seulement à 9 ou 10 sur 10", () => {
    expect(showGoogleButton(9, url)).toBe(true);
    expect(showGoogleButton(10, url)).toBe(true);
    expect(showGoogleButton(8, url)).toBe(false);
    expect(showGoogleButton(null, url)).toBe(false);
  });
  it("caché tant que le lien de la fiche n'est pas enregistré", () => {
    expect(showGoogleButton(10, null)).toBe(false);
    expect(showGoogleButton(10, "")).toBe(false);
    expect(showGoogleButton(10, "http://exemple.com")).toBe(false);
  });
  it("copie la phrase pour un parent qui hésite, sinon ce que sa fille aime", () => {
    expect(reviewDraft({ phrase: "  Foncez,  elle adore. ", aime: "Les matchs" })).toBe("Foncez, elle adore.");
    expect(reviewDraft({ aime: "Les matchs" })).toBe("Les matchs");
    expect(reviewDraft(null)).toBe("");
  });
});

describe("aperçu avant la date de remise", () => {
  it("seulement les courriels de la liste", () => {
    expect(hasEarlyAccess("Test@NewValkyria.com", ["test@newvalkyria.com"])).toBe(true);
    expect(hasEarlyAccess("parent@exemple.com", ["test@newvalkyria.com"])).toBe(false);
    expect(hasEarlyAccess("x@y.com", null)).toBe(false);
    expect(hasEarlyAccess(null, ["x@y.com"])).toBe(false);
  });
});

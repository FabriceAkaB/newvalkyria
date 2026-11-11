import { describe, expect, it } from "vitest";

import {
  ACQUISITION_SOURCES,
  ACQUISITION_SOURCE_IDS,
  EMPTY_ACQUISITION,
  acquisitionColumns,
  acquisitionErrors,
  acquisitionHeadline,
  businessFamilies,
  channelBreakdown,
  familiesWithoutSource,
  firstAcquisitionError,
  knownSourceShare,
  markConversions,
  matchReferralMentions,
  recentFamiliesWithoutSource,
  sourceLabel,
  toAcquisitionPayload,
  type AcqRecord
} from "@/lib/acquisition-core";

const rec = (over: Partial<AcqRecord>): AcqRecord => ({
  table: "registrations",
  id: Math.random().toString(36).slice(2),
  program: "Saison filles",
  playerFirst: "Léa",
  playerLast: "Tremblay",
  parentName: "Marie Tremblay",
  parentEmail: "marie@example.com",
  parentPhone: null,
  createdAt: "2026-09-01T12:00:00Z",
  source: null,
  detail: null,
  hasBusiness: null,
  businessName: null,
  ...over
});

describe("liste des canaux", () => {
  it("chaque clé stable a sa définition, dans le même ordre", () => {
    expect(ACQUISITION_SOURCES.map((s) => s.id)).toEqual([...ACQUISITION_SOURCE_IDS]);
  });

  it("couvre les canaux demandés par JP", () => {
    for (const id of ["parrainage", "reseaux", "journee_valkyria", "parascolaire", "camp", "club_partenaire", "google", "publicite", "bouche_a_oreille", "autre"]) {
      expect(ACQUISITION_SOURCE_IDS).toContain(id);
    }
  });

  it("libellé court, « Source inconnue » sans réponse", () => {
    expect(sourceLabel("reseaux")).toBe("Vidéo et réseaux sociaux");
    expect(sourceLabel(null)).toBe("Source inconnue");
    expect(sourceLabel("n-importe-quoi")).toBe("Source inconnue");
  });
});

describe("validation du formulaire (question obligatoire)", () => {
  it("refuse un formulaire sans réponse", () => {
    const e = acquisitionErrors(EMPTY_ACQUISITION);
    expect(e.source).toBeTruthy();
    expect(firstAcquisitionError(e)).toBe(e.source);
  });

  it("exige le code ou le nom pour le parrainage, le réseau pour la vidéo, la précision pour « Autre »", () => {
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "parrainage" }).detail).toBeTruthy();
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "reseaux" }).detail).toBe("Choisissez le réseau.");
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "autre" }).detail).toBeTruthy();
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "reseaux", detail: "Instagram" })).toEqual({});
    // « Autre réseau » : un parent qui a vu la vidéo ailleurs n'est jamais bloqué.
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "reseaux", detail: "Autre réseau" })).toEqual({});
  });

  it("le parrainage saisi dans le bloc Recommandation suffit", () => {
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "parrainage" }, { detailProvided: true })).toEqual({});
  });

  it("précision facultative pour le camp, Google sans précision", () => {
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "camp" })).toEqual({});
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "google" })).toEqual({});
  });

  it("l'entreprise reste facultative, mais « Oui » demande le nom", () => {
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "google", hasBusiness: false })).toEqual({});
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "google", hasBusiness: true }).businessName).toBeTruthy();
    expect(acquisitionErrors({ ...EMPTY_ACQUISITION, source: "google", hasBusiness: true, businessName: "Toitures Roy" })).toEqual({});
  });
});

describe("envoi et enregistrement", () => {
  it("le formulaire n'envoie rien sans réponse, et la précision remplacée par le bloc Recommandation", () => {
    expect(toAcquisitionPayload(EMPTY_ACQUISITION)).toBeUndefined();
    expect(toAcquisitionPayload({ ...EMPTY_ACQUISITION, source: "parrainage" }, "ABC123 · Famille Roy")).toEqual({ source: "parrainage", detail: "ABC123 · Famille Roy", hasBusiness: null });
    expect(toAcquisitionPayload({ source: "camp", detail: " ", hasBusiness: true, businessName: " Toitures Roy " })).toEqual({ source: "camp", hasBusiness: true, businessName: "Toitures Roy" });
  });

  it("colonnes tolérantes : une valeur inconnue est ignorée, jamais d'erreur", () => {
    expect(acquisitionColumns(undefined)).toBeNull();
    expect(acquisitionColumns("parrainage")).toBeNull();
    expect(acquisitionColumns({ source: "pas-un-canal" })).toBeNull();
    expect(acquisitionColumns({ source: "google", detail: "  très   loin " })).toEqual({ acquisition_source: "google", acquisition_detail: "très loin", has_business: null, business_name: null });
    // Entreprise sans source : on garde quand même l'entreprise.
    expect(acquisitionColumns({ source: "x", hasBusiness: true, businessName: "Roy inc." })).toEqual({ acquisition_source: null, acquisition_detail: null, has_business: true, business_name: "Roy inc." });
    // « Non » efface le nom envoyé par erreur.
    expect(acquisitionColumns({ source: "camp", hasBusiness: false, businessName: "Roy" })?.business_name).toBeNull();
    expect(acquisitionColumns({ source: "autre", detail: "x".repeat(500) })?.acquisition_detail).toHaveLength(200);
  });
});

describe("tableau par canal et conversion des essais", () => {
  const paid = [
    rec({ source: "parrainage", detail: "ABC123", parentEmail: "a@x.com", playerFirst: "Alice", playerLast: "Roy" }),
    rec({ source: "parrainage", parentEmail: "b@x.com", playerFirst: "Béa", playerLast: "Roy" }),
    rec({ source: "reseaux", detail: "Instagram", parentEmail: "c@x.com", playerFirst: "Chloé", playerLast: "Côté", createdAt: "2026-09-20T12:00:00Z" }),
    rec({ source: null, parentEmail: "d@x.com", playerFirst: "Dina", playerLast: "Diop" })
  ];
  const trialsRaw = [
    rec({ table: "boys_trials", source: "reseaux", playerFirst: "CHLOÉ", playerLast: "cote", createdAt: "2026-09-10T12:00:00Z" }),
    rec({ table: "boys_trials", source: "reseaux", playerFirst: "Zoé", playerLast: "Zed", createdAt: "2026-09-10T12:00:00Z" }),
    rec({ table: "boys_trials", source: "google", playerFirst: "Alice", playerLast: "Roy", createdAt: "2026-10-30T12:00:00Z" })
  ];

  it("un essai suivi d'une inscription payée (même joueuse, accents ignorés) est converti", () => {
    const t = markConversions(trialsRaw, paid);
    expect(t.map((x) => x.converted)).toEqual([true, false, false]);
  });

  it("un essai converti sur la même ligne compte", () => {
    const same = rec({ id: "r1", source: "camp", createdAt: "2026-10-01T12:00:00Z" });
    expect(markConversions([same], [{ ...same, createdAt: "2026-09-01T12:00:00Z" }])[0].converted).toBe(true);
  });

  it("parts, conversion par canal, « Source inconnue » en dernier", () => {
    const rows = channelBreakdown(paid, markConversions(trialsRaw, paid));
    expect(rows.map((r) => r.label)).toEqual(["Parrainage", "Vidéo et réseaux sociaux", "Recherche Google", "Source inconnue"]);
    expect(rows[0].share).toBeCloseTo(2 / 3);
    expect(rows[1].conversion).toBe(0.5);
    expect(rows[1].topDetails).toEqual([{ label: "Instagram", count: 1 }]);
    expect(rows[3].share).toBeNull();
  });

  it("indicateur source_connue par famille", () => {
    expect(knownSourceShare(paid)).toEqual({ families: 4, known: 3, pct: 75 });
    expect(knownSourceShare([])).toEqual({ families: 0, known: 0, pct: null });
    // Une famille avec deux enfants dont un seul a une source compte comme connue.
    expect(knownSourceShare([rec({ source: "camp" }), rec({ source: null, playerFirst: "Sœur" })]).pct).toBe(100);
  });

  it("familles sans source, regroupées par courriel", () => {
    const missing = familiesWithoutSource([...paid, rec({ source: null, parentEmail: "D@x.com ", playerFirst: "Dalia", playerLast: "Diop" })]);
    expect(missing).toHaveLength(1);
    expect(missing[0].players).toEqual(["Dina Diop", "Dalia Diop"]);
    expect(missing[0].refs).toHaveLength(2);
  });

  it("Aujourd'hui : seulement les familles récentes, et une réponse plus ancienne de la même famille compte", () => {
    const old = rec({ source: "camp", parentEmail: "e@x.com", playerFirst: "Émma", playerLast: "Roy", createdAt: "2026-09-01T12:00:00Z" });
    const sister = rec({ source: null, parentEmail: "e@x.com", playerFirst: "Zoé", playerLast: "Roy", createdAt: "2026-11-05T12:00:00Z" });
    const fresh = rec({ source: null, parentEmail: "f@x.com", playerFirst: "Fanny", playerLast: "Gill", createdAt: "2026-11-04T12:00:00Z" });
    const stale = rec({ source: null, parentEmail: "g@x.com", playerFirst: "Gaïa", playerLast: "Lee", createdAt: "2026-09-10T12:00:00Z" });
    const missing = recentFamiliesWithoutSource([old, sister, fresh, stale], "2026-10-23T12:00:00.000Z");
    expect(missing.map((f) => f.parentEmail)).toEqual(["f@x.com"]);
  });

  it("phrase-titre", () => {
    const rows = channelBreakdown(paid, []);
    expect(acquisitionHeadline(rows, knownSourceShare(paid))).toBe("Parrainage : 67 % des inscriptions dont la source est connue");
    expect(acquisitionHeadline([], knownSourceShare([]))).toBe("Aucune inscription payée cette saison");
    expect(acquisitionHeadline(channelBreakdown([rec({})], []), knownSourceShare([rec({})]))).toBe("On ne sait pas encore d'où viennent nos familles");
  });
});

describe("entreprises et codes de référence", () => {
  it("une ligne par entreprise et par famille, déjà suivie reconnue", () => {
    const list = businessFamilies(
      [
        rec({ hasBusiness: true, businessName: "Toitures Roy", parentEmail: "a@x.com" }),
        rec({ hasBusiness: true, businessName: "toitures roy", parentEmail: "a@x.com", playerFirst: "Sœur" }),
        rec({ hasBusiness: true, businessName: "Garage Côté", parentEmail: "b@x.com" }),
        rec({ hasBusiness: true, businessName: " ", parentEmail: "c@x.com" }),
        rec({ hasBusiness: false, businessName: "Ignoré", parentEmail: "d@x.com" })
      ],
      [{ companyName: "GARAGE COTE", contactEmail: null }]
    );
    expect(list.map((b) => [b.businessName, b.inSponsors, b.players.length])).toEqual([
      ["Toitures Roy", false, 2],
      ["Garage Côté", true, 1]
    ]);
  });

  it("retrouve le code, le courriel ou le nom de la famille qui parraine", () => {
    const codes = [
      { code: "ABC123", familyEmail: "roy@x.com", familyName: "Famille Roy" },
      { code: "XYZ999", familyEmail: "cote@x.com", familyName: "Famille Côté" }
    ];
    const m = matchReferralMentions(
      [
        rec({ source: "parrainage", detail: "code abc123 merci" }),
        rec({ source: "parrainage", detail: "cote@x.com" }),
        rec({ source: "parrainage", detail: "C'est la famille cote" }),
        rec({ source: "parrainage", detail: "une amie" }),
        rec({ source: "google", detail: "ABC123" })
      ],
      codes
    );
    expect(m.map((x) => x.code)).toEqual(["ABC123", "XYZ999", "XYZ999", null]);
  });
});

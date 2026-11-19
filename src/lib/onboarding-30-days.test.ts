import { describe, expect, it } from "vitest";

import {
  childrenLabel,
  daytime,
  de,
  findNewFamilies,
  firstDatedSession,
  frenchTime,
  nextWeeklySession,
  normPlayer,
  onboardingEmail,
  onboardingRef,
  onboardingSchedule,
  parseActive,
  parseVideoUrl,
  planOnboarding,
  torontoAt,
  torontoDate,
  type OnboardingFamily,
  type PaidRegistration
} from "./onboarding-30-days";

const reg = (over: Partial<PaidRegistration>): PaidRegistration => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  source: "saison",
  email: "parent@exemple.com",
  parentName: "Marie Tremblay",
  playerFirstName: "Emma",
  playerLastName: "Côté",
  paidAt: "2026-11-19T15:00:00.000Z",
  programLabel: "Team Valkyria",
  ...over
});

const family = (over: Partial<OnboardingFamily> = {}): OnboardingFamily => ({
  key: "parent@exemple.com",
  email: "parent@exemple.com",
  parentName: "Marie Tremblay",
  children: ["Emma"],
  programs: ["Team Valkyria"],
  paidAt: "2026-11-19T15:00:00.000Z",
  registrationIds: ["r1"],
  firstSession: { date: "2026-11-30", start: "19:30", end: "20:55", location: "Sainte-Thérèse", source: "horaire" },
  ...over
});

const since = "2026-11-18T15:00:00.000Z";

describe("findNewFamilies", () => {
  it("garde une famille sans inscription payée avant", () => {
    const r = reg({ id: "a" });
    const { families, notNew } = findNewFamilies([r], [r], since);
    expect(notNew).toBe(0);
    expect(families).toHaveLength(1);
    expect(families[0].children).toEqual(["Emma"]);
  });

  it("une famille d'une saison précédente n'est pas nouvelle (même courriel)", () => {
    const r = reg({ id: "a" });
    const old = reg({ id: "old", paidAt: "2026-05-01T12:00:00.000Z", playerFirstName: "Autre", playerLastName: "Enfant" });
    expect(findNewFamilies([r], [r, old], since)).toEqual({ families: [], notNew: 1 });
  });

  it("l'autre parent a inscrit la même joueuse avec un autre courriel : pas nouvelle (nom sans accents)", () => {
    const r = reg({ id: "a" });
    const old = reg({ id: "old", email: "papa@ailleurs.com", playerFirstName: "EMMA", playerLastName: "Cote", paidAt: "2026-02-01T12:00:00.000Z" });
    expect(findNewFamilies([r], [old], since).notNew).toBe(1);
  });

  it("frère et sœur payés à un jour d'écart : une seule famille nouvelle, deux enfants", () => {
    const a = reg({ id: "a", paidAt: "2026-11-18T20:00:00.000Z" });
    const b = reg({ id: "b", playerFirstName: "Léa", paidAt: "2026-11-19T10:00:00.000Z", programLabel: "Solo Valkyria" });
    const { families } = findNewFamilies([a, b], [a, b], since);
    expect(families).toHaveLength(1);
    expect(families[0].children).toEqual(["Emma", "Léa"]);
    expect(families[0].paidAt).toBe("2026-11-18T20:00:00.000Z");
  });

  it("ignore ce qui est payé avant la fenêtre et les courriels vides", () => {
    expect(findNewFamilies([reg({ paidAt: "2026-11-10T00:00:00.000Z" }), reg({ email: "" })], [], since).families).toEqual([]);
  });
});

describe("dates", () => {
  it("prochaine séance d'une plage du lundi après le paiement", () => {
    const paid = new Date("2026-11-19T15:00:00.000Z").getTime(); // jeudi
    expect(nextWeeklySession({ day: "Lundi", start_time: "19:30", end_time: "20:55", location: "Sainte-Thérèse" }, paid)?.date).toBe("2026-11-23");
  });

  it("le jour même si la séance est plus tard dans la journée", () => {
    const paid = torontoAt("2026-11-23", "10:00");
    expect(nextWeeklySession({ day: "lundi", start_time: "19:30" }, paid)?.date).toBe("2026-11-23");
    expect(nextWeeklySession({ day: "lundi", start_time: "08:00" }, paid)?.date).toBe("2026-11-30");
  });

  it("jamais avant le début de la saison", () => {
    const paid = new Date("2026-06-01T12:00:00.000Z").getTime();
    expect(nextWeeklySession({ day: "Mercredi", start_time: "18:00" }, paid, "2026-09-01")?.date).toBe("2026-09-02");
  });

  it("jour inconnu : pas de séance", () => {
    expect(nextWeeklySession({ day: "Bientôt", start_time: "18:00" }, Date.now())).toBeNull();
  });

  it("première séance datée (MonClubSportif) après le paiement", () => {
    const paid = torontoAt("2026-11-20", "12:00");
    const s = firstDatedSession(
      [
        { date: "2026-11-27", start: "18:00", location: "Prévost" },
        { date: "2026-11-20", start: "09:00" },
        { date: "2026-11-22", start: "10:00", end: "11:30", location: "Synthétique" }
      ],
      paid,
      "monclubsportif"
    );
    expect(s).toEqual({ date: "2026-11-22", start: "10:00", end: "11:30", location: "Synthétique", source: "monclubsportif" });
  });

  it("aucun courriel la nuit", () => {
    expect(torontoDate(daytime(torontoAt("2026-11-19", "23:30")))).toBe("2026-11-20");
    expect(daytime(torontoAt("2026-11-19", "05:00"))).toBe(torontoAt("2026-11-19", "08:00"));
    expect(daytime(torontoAt("2026-11-19", "14:00"))).toBe(torontoAt("2026-11-19", "14:00"));
  });
});

describe("onboardingSchedule", () => {
  const now = new Date("2026-11-19T15:30:00.000Z");

  it("cinq étapes dans l'ordre, rappel 2 jours avant à 18 h, après le lendemain à 10 h", () => {
    const s = onboardingSchedule(family(), now);
    expect(s.map((x) => x.step)).toEqual(["bienvenue", "rappel", "apres", "jour14", "jour30"]);
    expect(s[1].sendAt).toBe(new Date(torontoAt("2026-11-28", "18:00")).toISOString());
    expect(s[2].sendAt).toBe(new Date(torontoAt("2026-12-01", "10:00")).toISOString());
    // Jours 14 et 30 comptés depuis la 1re séance (après le paiement).
    expect(s[3].sendAt).toBe(new Date(torontoAt("2026-12-14", "10:00")).toISOString());
    expect(s[4].sendAt).toBe(new Date(torontoAt("2026-12-30", "10:00")).toISOString());
    const times = s.map((x) => x.sendAt);
    expect([...times].sort()).toEqual(times);
  });

  it("1re séance le lendemain : pas de rappel séparé (la bienvenue la donne)", () => {
    const s = onboardingSchedule(family({ firstSession: { date: "2026-11-20", start: "18:00", end: null, location: null, source: "horaire" } }), now);
    expect(s.map((x) => x.step)).toEqual(["bienvenue", "apres", "jour14", "jour30"]);
  });

  it("programmée en retard : une étape déjà passée saute, rien avant la bienvenue", () => {
    const late = new Date(torontoAt("2026-12-01", "14:00"));
    const s = onboardingSchedule(family(), late);
    expect(s.map((x) => x.step)).toEqual(["bienvenue", "jour14", "jour30"]);
  });

  it("horaire inconnu : bienvenue, jour 14 et jour 30 depuis le paiement", () => {
    const s = onboardingSchedule(family({ firstSession: null }), now);
    expect(s.map((x) => x.step)).toEqual(["bienvenue", "jour14", "jour30"]);
    expect(s[1].sendAt).toBe(new Date(torontoAt("2026-12-03", "10:00")).toISOString());
  });
});

describe("planOnboarding", () => {
  it("références par famille et par étape, sans doublon", () => {
    const f = family();
    const all = planOnboarding(f, new Date("2026-11-19T15:30:00.000Z"), null);
    expect(all.map((p) => p.ref)).toContain("accueil30:parent@exemple.com:bienvenue");
    const again = planOnboarding(f, new Date("2026-11-19T16:30:00.000Z"), null, new Set(all.map((p) => p.ref)));
    expect(again).toEqual([]);
    const partial = planOnboarding(f, new Date("2026-11-19T16:30:00.000Z"), null, new Set([onboardingRef(f.key, "bienvenue")]));
    expect(partial.map((p) => p.step)).toEqual(["rappel", "apres", "jour14", "jour30"]);
  });
});

describe("textes", () => {
  it("bienvenue : espace famille, vidéo seulement si le lien existe, 1re séance", () => {
    const without = onboardingEmail("bienvenue", family(), null);
    expect(without.html).toContain("https://www.newvalkyria.com/compte");
    expect(without.html).not.toContain("vidéo de bienvenue");
    expect(without.text).toContain("lundi 30 novembre");
    expect(without.text).toContain("19 h 30 à 20 h 55");
    const withVideo = onboardingEmail("bienvenue", family(), "https://youtu.be/abc");
    expect(withVideo.html).toContain("https://youtu.be/abc");
  });

  it("rappel : quoi apporter (tenue, ballon, gourde)", () => {
    const r = onboardingEmail("rappel", family(), null);
    expect(r.text).toMatch(/tenue/);
    expect(r.text).toMatch(/ballon/);
    expect(r.text).toMatch(/gourde/);
    expect(r.subject).toContain("d'Emma");
  });

  it("après, jour 14 et jour 30 : bons liens de l'espace famille, pluriel", () => {
    expect(onboardingEmail("apres", family(), null).html).toContain("/compte/idees");
    const j14 = onboardingEmail("jour14", family({ children: ["Emma", "Léa"] }), null);
    expect(j14.html).toContain("/compte/points");
    expect(j14.html).toContain("/compte/lab");
    expect(j14.text).toContain("Emma et Léa gagnent");
    expect(onboardingEmail("jour30", family(), null).subject).toBe("Comment se passent vos 30 premiers jours ?");
  });

  it("échappe les noms", () => {
    expect(onboardingEmail("apres", family({ children: ["<b>X</b>"] }), null).html).not.toContain("<b>X</b>");
  });
});

describe("petits outils", () => {
  it("réglages", () => {
    expect(parseActive(null)).toBe(false);
    expect(parseActive("")).toBe(false);
    expect(parseActive("false")).toBe(false);
    expect(parseActive("true")).toBe(true);
    expect(parseVideoUrl("")).toBeNull();
    expect(parseVideoUrl("http://x.com")).toBeNull();
    expect(parseVideoUrl("https://youtu.be/x")).toBe("https://youtu.be/x");
  });
  it("français", () => {
    expect(frenchTime("18:00")).toBe("18 h");
    expect(frenchTime("09:05")).toBe("9 h 05");
    expect(childrenLabel([])).toBe("votre enfant");
    expect(childrenLabel(["A", "B", "C"])).toBe("A, B et C");
    expect(de("Emma")).toBe("d'Emma");
    expect(de("Léa")).toBe("de Léa");
    expect(normPlayer("Marie-Ève", "Côté")).toBe("marie eve cote");
    expect(normPlayer("Emma", "")).toBe("");
  });
});

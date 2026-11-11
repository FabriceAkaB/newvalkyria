import { describe, expect, it } from "vitest";

import {
  adultsNeeded,
  buildPeople,
  certKind,
  certState,
  currentCerts,
  daysFromText,
  employmentFromText,
  isCovered,
  mergeBlocks,
  nextStage,
  peakNeed,
  rateCentsFromText,
  recruitDueFor,
  recruitsNeeded,
  recruitsNeededFull,
  roleFromContractTitle,
  runScenario,
  samePerson,
  sessionsCoverage,
  shortDays,
  nextRecruitDue,
  teamByDay,
  uncoveredMinutesPerWeek,
  weekdayOfIso,
  weeklyPlan,
  type BlockIn,
  type ContractIn,
  type StaffIn
} from "@/lib/structure-core";

const TODAY = "2026-11-02";

const staff = (over: Partial<StaffIn>): StaffIn => ({
  id: "s1",
  full_name: "Personne",
  role: "Rôle",
  team: "soutien",
  employment: null,
  email: null,
  phone: null,
  diplomas: null,
  certifications: [],
  started_on: null,
  notes: null,
  coach_id: null,
  on_field: false,
  available_days: [],
  hourly_rate_cents: null,
  active: true,
  sort_order: 100,
  ...over
});

const contract = (over: Partial<ContractIn>): ContractIn => ({
  id: "k1",
  employee_name: "X",
  title: "Entraîneuse — saison 2026-2027",
  status: "sent",
  summary: [],
  signed_at: null,
  created_at: "2026-11-01T00:00:00Z",
  email: null,
  phone: null,
  ...over
});

describe("lecture des contrats", () => {
  it("statut d'emploi, taux et jours", () => {
    expect(employmentFromText("Entraîneuse — contrat saisonnier à temps partiel, sur appel, heures variables")).toBe("sur_appel");
    expect(employmentFromText("Entraîneuse adjointe — saisonnier, temps partiel, heures variables")).toBe("temps_partiel");
    expect(employmentFromText("Directeur technique à temps plein")).toBe("temps_plein");
    expect(employmentFromText("")).toBeNull();
    expect(rateCentsFromText("40,00 $ de l'heure — heures terrain et heures maison")).toBe(4000);
    expect(rateCentsFromText("25,00 $ de l’heure")).toBe(2500);
    expect(rateCentsFromText("à discuter")).toBeNull();
    expect(daysFromText("Dimanche, mercredi et jeudi; lundi à compter de janvier 2027")).toEqual(["mercredi", "jeudi", "dimanche"]);
    expect(daysFromText("Lundi, Sainte-Thérèse : les 2 séances (18 h à 20 h 55). Autres séances sur demande.")).toEqual(["lundi"]);
    expect(daysFromText("Selon les séances, matchs ou tournages qui lui sont assignés")).toEqual([]);
    expect(roleFromContractTitle("Entraîneuse adjointe — saison 2026-2027")).toBe("Entraîneuse adjointe");
  });
});

describe("même personne", () => {
  it("tolère accents, majuscules, s final et prénom seul", () => {
    expect(samePerson("maéva désjardin", "Maeva Desjardins")).toBe(true);
    expect(samePerson("noura ouatara", "Noura")).toBe(true);
    expect(samePerson("Will", "William Tremblay")).toBe(true);
    expect(samePerson("Noura Ouatara", "Noura Bensaïd")).toBe(false);
    expect(samePerson("Maeva", "Annie")).toBe(false);
    expect(samePerson("", "Annie")).toBe(false);
  });
});

describe("certifications", () => {
  it("reconnaît le type", () => {
    expect(certKind("Vérification des antécédents judiciaires")).toBe("antecedents");
    expect(certKind("Respect et sport")).toBe("sport_securitaire");
    expect(certKind("Formation Sport sécuritaire")).toBe("sport_securitaire");
    expect(certKind("Licence C")).toBe("licence");
    expect(certKind("Entraîneur B")).toBe("licence");
    expect(certKind("Premiers soins - RCR")).toBe("premiers_soins");
    expect(certKind("Permis de conduire")).toBe("autre");
  });
  it("une certification renouvelée remplace l'ancienne (même type, ou même nom pour une licence)", () => {
    const c = (name: string, expiresOn: string | null) => ({ name, expiresOn });
    const old = c("Vérification des antécédents judiciaires", "2025-10-01");
    const renewed = c("Antécédents judiciaires (renouvellement)", "2028-10-01");
    expect(currentCerts([old, renewed])).toEqual([renewed]);
    // Sans date d'expiration = n'expire pas : remplace une ancienne preuve expirée du même type
    const noDate = c("Respect et sport", null);
    const expiredSafe = c("Formation Sport sécuritaire", "2025-01-01");
    expect(currentCerts([expiredSafe, noDate])).toEqual([noDate]);
    // Deux licences différentes restent toutes les deux ; types différents aussi
    const lc = c("Licence C", "2026-01-01");
    const lb = c("Licence B", "2029-01-01");
    expect(currentCerts([lc, lb, old])).toEqual([lc, lb, old]);
    expect(currentCerts([])).toEqual([]);
  });
  it("état selon la date d'expiration (60 jours)", () => {
    expect(certState(null, TODAY)).toBe("sans_date");
    expect(certState("2026-11-01", TODAY)).toBe("expiree");
    expect(certState("2026-11-02", TODAY)).toBe("bientot");
    expect(certState("2027-01-01", TODAY)).toBe("bientot");
    expect(certState("2027-01-02", TODAY)).toBe("valide");
    expect(certState("2026-11-20", TODAY, 30)).toBe("bientot");
  });
});

describe("liste des personnes", () => {
  const people = buildPeople(
    {
      coaches: [
        { id: "c1", first_name: "maéva", last_name: "désjardin", email: null, phone: null, status: "active", role: "Entraîneur principal", default_hourly_rate_cents: 0, hired_on: null },
        { id: "c2", first_name: "noura", last_name: "ouatara", email: null, phone: null, status: "active", role: "Entraîneur principal", default_hourly_rate_cents: 2500, hired_on: null }
      ],
      certs: [
        { id: "x1", coach_id: "c2", name: "Antécédents judiciaires", issued_date: "2024-01-10", expiry_date: "2026-12-01" },
        { id: "x2", coach_id: "c2", name: "Respect et sport", issued_date: null, expiry_date: null },
        { id: "x3", coach_id: "c2", name: "Antécédents judiciaires", issued_date: "2021-01-10", expiry_date: "2024-01-10" }
      ],
      typeRates: [{ coach_id: "c1", activity_type: "Pratique", hourly_rate_cents: 8000 }],
      contracts: [
        contract({ id: "k1", employee_name: "Maeva Desjardins", title: "Entraîneuse adjointe — saison 2026-2027", summary: [{ label: "Poste", value: "temps partiel" }, { label: "Présence", value: "Mercredi et jeudi" }, { label: "Taux horaire", value: "40,00 $ de l'heure" }] }),
        contract({ id: "k2", employee_name: "Will", title: "Entraîneur de soutien — saison 2026-2027", summary: [{ label: "Poste", value: "temps partiel" }, { label: "Présence", value: "Lundi" }, { label: "Taux horaire", value: "25,00 $" }] }),
        contract({ id: "k3", employee_name: "Noura", summary: [{ label: "Poste", value: "temps partiel, sur appel" }, { label: "Taux horaire", value: "30,00 $" }] }),
        contract({ id: "k0", employee_name: "Noura", status: "cancelled", created_at: "2026-12-01T00:00:00Z" })
      ],
      staff: [
        staff({ id: "s-jp", full_name: "JP", role: "Fondateur et entraîneur-chef", team: "direction", employment: "temps_plein", on_field: true, available_days: ["lundi", "samedi"], sort_order: 1 }),
        staff({ id: "s-annie", full_name: "Annie Tremblay", role: "Responsable administratif", team: "direction", sort_order: 2 }),
        staff({ id: "s-will", full_name: "Will Gagnon", role: "Entraîneur de soutien", team: "terrain", on_field: true, certifications: [{ name: "Antécédents judiciaires", expires_on: "2026-10-01" }] }),
        staff({ id: "s-maeva", coach_id: "c1", full_name: "Maeva Desjardins", role: "Entraîneuse adjointe", team: "terrain", on_field: true, available_days: ["mercredi", "jeudi", "dimanche"], employment: "temps_partiel" })
      ],
      assignments: [
        { coach_id: "c2", date: "2026-11-12", minutes: 85 },
        { coach_id: "c2", date: "2026-11-05", minutes: 120 },
        { coach_id: "c2", date: "2026-11-07", minutes: 90, outside: true }
      ]
    },
    TODAY
  );
  const byName = (n: string) => people.find((p) => p.name.startsWith(n))!;

  it("aucun doublon : fiche entraîneur + contrat + fiche Structure = une personne", () => {
    expect(people.map((p) => p.name)).toEqual(["JP", "Annie Tremblay", "Maeva Desjardins", "Noura Ouatara", "Will Gagnon"]);
    expect(people.map((p) => p.team)).toEqual(["direction", "direction", "terrain", "terrain", "terrain"]);
  });

  it("le contrat donne le rôle, le statut, le taux et les jours ; la fiche Structure a le dernier mot", () => {
    const maeva = byName("Maeva");
    expect(maeva.coachId).toBe("c1");
    expect(maeva.staffId).toBe("s-maeva");
    expect(maeva.role).toBe("Entraîneuse adjointe");
    expect(maeva.rateCents).toBe(4000);
    expect(maeva.rateFrom).toBe("contrat");
    expect(maeva.portalRateCents).toBe(8000);
    expect(maeva.availableDays).toEqual(["mercredi", "jeudi", "dimanche"]);
    expect(maeva.daysFrom).toBe("fiche");
    const noura = byName("Noura");
    expect(noura.employment).toBe("sur_appel");
    expect(noura.contract?.id).toBe("k3");
    expect(noura.rateCents).toBe(3000);
    expect(noura.next30).toEqual({ count: 2, minutes: 205, next: "2026-11-05", outside: 1 });
    // Aucun jour au contrat ni sur une fiche : les jours viennent de ses assignations de l'Académie.
    expect(noura.availableDays).toEqual(["jeudi"]);
    expect(noura.daysFrom).toBe("portail");
  });

  it("JP : fiche Direction (avec surnom) + fiche entraîneur = une seule personne", () => {
    const merged = buildPeople(
      {
        coaches: [{ id: "c-jp", first_name: "Jean-Paul", last_name: "Aka Boidi", email: null, phone: null, status: "active", role: "Entraîneur principal", default_hourly_rate_cents: 0, hired_on: null }],
        certs: [],
        typeRates: [],
        contracts: [],
        staff: [staff({ id: "s-jp", full_name: "Jean-Paul Aka Boidi (JP)", role: "Fondateur et entraîneur-chef", team: "direction", employment: "temps_plein", on_field: true, sort_order: 1 })],
        assignments: [{ coach_id: "c-jp", date: "2026-11-07", minutes: 85 }]
      },
      TODAY
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ name: "Jean-Paul Aka Boidi (JP)", team: "direction", coachId: "c-jp", staffId: "s-jp", availableDays: ["samedi"], daysFrom: "portail" });
    expect(samePerson("Jean-Paul Aka Boidi (JP)", "jean-paul aka boidi")).toBe(true);
  });

  it("signale ce qui demande une action", () => {
    const maeva = byName("Maeva");
    const texts = maeva.flags.map((f) => f.text);
    expect(texts).toContain("Antécédents judiciaires : aucune preuve au dossier");
    expect(texts).toContain("Contrat envoyé, pas encore signé");
    expect(texts.some((t) => t.startsWith("Taux du portail (80 $/h) différent du contrat (40 $/h)"))).toBe(true);
    const noura = byName("Noura");
    expect(noura.flags.find((f) => f.text.startsWith("Antécédents judiciaires expire"))?.tone).toBe("warn");
    expect(noura.flags.some((f) => f.text.includes("aucune preuve"))).toBe(false);
    // L'ancienne preuve d'antécédents (expirée en 2024) a été renouvelée : elle n'est plus affichée ni signalée
    expect(noura.certifications.map((c) => c.expiresOn)).toEqual(["2026-12-01", null]);
    expect(noura.flags.some((f) => f.text.includes("expirée"))).toBe(false);
    const will = byName("Will");
    expect(will.coachId).toBeNull();
    expect(will.flags.find((f) => f.text.startsWith("Antécédents judiciaires expirée"))?.tone).toBe("bad");
    expect(will.flags.some((f) => f.text.startsWith("Pas de fiche entraîneur"))).toBe(true);
    expect(byName("Annie").flags).toEqual([]);
  });
});

describe("besoins en éducateurs", () => {
  it("1 pour 10, au moins 1 par groupe, jamais moins de 2 adultes", () => {
    expect(adultsNeeded([])).toBe(0);
    expect(adultsNeeded([{ players: 0 }])).toBe(0);
    expect(adultsNeeded([{ players: 4 }])).toBe(2);
    expect(adultsNeeded([{ players: 15 }])).toBe(2);
    expect(adultsNeeded([{ players: 21 }])).toBe(3);
    expect(adultsNeeded([{ players: 3 }, { players: 3 }, { players: 3 }])).toBe(3);
    expect(adultsNeeded([{ players: 30 }], { playersPerEducator: 10, minAdults: 2, arrivalMinutes: 30 })).toBe(3);
  });

  it("les séances qui se chevauchent s'additionnent", () => {
    expect(peakNeed([])).toBe(0);
    expect(peakNeed([{ start: "18:00", end: "19:25", need: 2 }, { start: "19:30", end: "20:55", need: 2 }])).toBe(2);
    expect(peakNeed([{ start: "18:00", end: "19:25", need: 2 }, { start: "18:30", end: "19:45", need: 3 }])).toBe(5);
  });

  const blocks: BlockIn[] = [
    { day: "lundi", start: "18:00", end: "19:25", location: "Sainte-Thérèse", source: "filles", groups: [{ label: "2016 avancé", players: 15, capacity: 15 }] },
    { day: "lundi", start: "19:30:00", end: "20:55", location: "Sainte-Thérèse", source: "filles", groups: [{ label: "2015", players: 10, capacity: 15 }] },
    { day: "lundi", start: "19:30", end: "20:55", location: "Sainte-thérèse", source: "filles", groups: [{ label: "2014-2013", players: 0, capacity: 4 }] },
    { day: "samedi", start: "12:00", end: "13:00", location: "Chambéry", source: "programme", groups: [{ label: "Garçons 2015", players: 6, capacity: 14 }] },
    { day: "samedi", start: "15:00", end: "16:30", location: "Chambéry", source: "programme", groups: [{ label: "Garçons 2018", players: 0, capacity: 14 }] }
  ];
  const merged = mergeBlocks(blocks);
  const team = [
    { name: "JP", onField: true, active: true, employment: "temps_plein" as const, availableDays: ["lundi" as const] },
    { name: "Will", onField: true, active: true, employment: "temps_partiel" as const, availableDays: ["lundi" as const] },
    { name: "Noura", onField: true, active: true, employment: "sur_appel" as const, availableDays: [] },
    { name: "Annie", onField: false, active: true, employment: null, availableDays: ["lundi" as const, "samedi" as const] }
  ];
  const plan = weeklyPlan(merged, team);

  it("réunit les groupes d'une même séance", () => {
    expect(merged).toHaveLength(4);
    const late = merged.find((b) => b.day === "lundi" && b.start === "19:30")!;
    expect(late.groups.map((g) => g.label)).toEqual(["2015", "2014-2013"]);
    expect(late.players).toBe(10);
    expect(late.capacity).toBe(19);
    expect(late.need).toBe(2);
    expect(late.needFull).toBe(2);
    expect(merged.find((b) => b.start === "15:00")!.need).toBe(0);
    expect(merged.find((b) => b.start === "15:00")!.needFull).toBe(2);
  });

  it("compare chaque jour à l'équipe disponible", () => {
    expect(plan.map((d) => d.day)).toEqual(["lundi", "samedi"]);
    const [lun, sam] = plan;
    expect(lun).toMatchObject({ need: 2, team: ["JP", "Will"], gap: 0, onCall: ["Noura"] });
    expect(sam).toMatchObject({ need: 2, team: [], gap: 2, onCall: ["Noura"] });
    expect(sam.spanMinutes).toBe(90);
    expect(lun.spanMinutes).toBe(205);
    expect(recruitsNeeded(plan)).toBe(2);
    expect(recruitsNeededFull(plan)).toBe(2);
    expect(uncoveredMinutesPerWeek(plan)).toBe(180);
  });

  it("séances des 30 prochains jours : assignés + équipe prévue ce jour-là, sans compter deux fois", () => {
    const cov = sessionsCoverage(
      [
        { date: "2026-11-09", start: "18:00:00", end: "19:25", location: "Sainte-Thérèse", coachIds: [] },
        { date: "2026-11-09", start: "19:30", end: "20:55", location: "Sainte-Thérèse", coachIds: ["c1"] },
        { date: "2026-11-09", start: "19:30", end: "20:55", location: "Sainte-Thérèse", coachIds: ["c1", "c2"] },
        { date: "2026-11-07", start: "12:00", end: "13:00", location: "Chambéry", coachIds: ["c2"] },
        { date: "2026-11-07", start: "15:00", end: "16:30", location: "Chambéry", coachIds: [] }
      ],
      merged,
      { lundi: ["staff:jp", "c2"] }
    );
    expect(cov.map((c) => [c.date, c.start, c.need, c.assigned, c.expected])).toEqual([
      ["2026-11-07", "12:00", 2, 1, 1],
      ["2026-11-09", "18:00", 2, 0, 2],
      ["2026-11-09", "19:30", 2, 2, 3]
    ]);
    expect(cov.map(isCovered)).toEqual([false, true, true]);
    expect(cov[2].groups).toBe("2015");
    expect(shortDays(plan)).toEqual(["samedi"]);
    expect(nextRecruitDue("2026-11-06")).toBe("2026-12-15");
    expect(nextRecruitDue("2026-12-20")).toBe("2027-01-15");
  });

  it("scénario croissance : combien recruter et la marge", () => {
    const tbd = teamByDay(team);
    expect(tbd.lundi).toBe(2);
    expect(tbd.samedi).toBe(0);
    const s = { groups: 3, playersPerGroup: 10, day: "dimanche" as const, together: true, practices: 10, sessionMinutes: 90, hourlyRateCents: 3000, pricePerPlayerCents: 43798, fieldCostPerHourCents: 3500 };
    const together = runScenario(plan, tbd, s);
    expect(together).toMatchObject({ players: 30, blocks: 1, adultsPerBlock: 3, dayNeedBefore: 0, dayNeedAfter: 3, teamThatDay: 0, recruitsBefore: 2, recruitsAfter: 3, extraRecruits: 1 });
    expect(together.educatorHoursPerWeek).toBe(6);
    expect(together.payrollCents).toBe(6 * 3000 * 10);
    expect(together.fieldCents).toBe(1.5 * 3500 * 10);
    expect(together.revenueCents).toBe(30 * 43798);
    expect(together.marginCents).toBe(30 * 43798 - 180000 - 52500);
    const apart = runScenario(plan, tbd, { ...s, together: false, day: "lundi" });
    expect(apart).toMatchObject({ blocks: 3, adultsPerBlock: 2, dayNeedBefore: 2, dayNeedAfter: 2, teamThatDay: 2, recruitsAfter: 2, extraRecruits: 0 });
    expect(apart.fieldCents).toBe(3 * 1.5 * 3500 * 10);
    expect(runScenario(plan, tbd, { ...s, groups: 0 })).toMatchObject({ players: 0, blocks: 0, payrollCents: 0, extraRecruits: 0 });
  });
});

describe("divers", () => {
  it("jour de la semaine, étapes et échéance d'anticipation", () => {
    expect(weekdayOfIso("2026-11-02")).toBe("lundi");
    expect(weekdayOfIso("2026-11-08T00:00:00Z")).toBe("dimanche");
    expect(nextStage("candidat")).toBe("entrevue");
    expect(nextStage("contrat")).toBeNull();
    expect(nextStage("refuse")).toBeNull();
    expect(recruitDueFor("2027-01")).toBe("2026-12-15");
    expect(recruitDueFor("2027-05")).toBe("2027-04-15");
  });
});

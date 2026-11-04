// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { expandEvents, parseIcal } from "@/lib/ical";
import {
  activityEnd,
  adminEventsFrom,
  birthYears,
  compareCalendars,
  fetchIcalText,
  guessActivityType,
  locationsMatch,
  maskIcalUrl,
  mcsEventFromOccurrence,
  normalizeIcalUrl,
  timeLabel,
  type CalEvent
} from "@/lib/mcs-calendar";
import type { Practice } from "@/lib/practices-repo";
import type { MatchRow } from "@/lib/referees-repo";

const ev = (over: Partial<CalEvent>): CalEvent => ({ key: Math.random().toString(36), date: "2026-11-09", start: "18:00", end: "19:25", title: "Pratique", location: "", source: "mcs", type: "Pratique", href: null, ...over });
const adm = (over: Partial<CalEvent>) => ev({ source: "saison", href: "/admin/saison?vue=horaire", ...over });

describe("lieu approximatif", () => {
  it("reconnaît le même endroit écrit autrement", () => {
    expect(locationsMatch("École de la Voltige (gym / futsal) – 191, rue Saint-Pierre, Sainte-Thérèse", "Sainte-Thérèse")).toBe(true);
    expect(locationsMatch("Complexe sportif Terrebonne, Centre de soccer multifonctionnel, terrain #4 – 2475, boul. des Entreprises, Terrebonne J6X 4J9 · Terrain n° 4", "Complexe sportif de Terrebonne")).toBe(true);
    expect(locationsMatch("ÉCOLE DES FALAISES, PRÉVOST", "Ecole des Falaises")).toBe(true);
  });

  it("distingue deux endroits différents, même avec « Saint » ou « École » en commun", () => {
    expect(locationsMatch("Collège Saint-Sacrement, Terrebonne", "Sainte-Thérèse")).toBe(false);
    expect(locationsMatch("École Chambéry, Blainville", "École des Falaises, Prévost")).toBe(false);
    expect(locationsMatch("Saint-Jérôme", "Saint-Sacrement")).toBe(false);
  });

  it("un lieu absent ne contredit rien", () => {
    expect(locationsMatch("", "Sainte-Thérèse")).toBe(true);
    expect(locationsMatch("Gymnase", "Sainte-Thérèse")).toBe(true);
  });
});

describe("groupes et types", () => {
  it("années de naissance d'un titre (pas l'année de la saison)", () => {
    expect(birthYears("Filles 2014, 2015 avancé", 2026)).toEqual([2014, 2015]);
    expect(birthYears("U12 F 2014-2015 · Automne-Hiver 2026", 2026)).toEqual([2014, 2015]);
    expect(birthYears("Pratique du 12 novembre", 2026)).toEqual([]);
  });

  it("devine le type d'une activité MonClubSportif", () => {
    expect(guessActivityType("Match 2015 avancé vs FC Laval")).toBe("Match");
    expect(guessActivityType("Partie contre Blainville")).toBe("Match");
    expect(guessActivityType("Tournoi de Noël")).toBe("Tournoi");
    expect(guessActivityType("Camp de la relâche")).toBe("Camp");
    expect(guessActivityType("Évaluations U10")).toBe("Évaluation");
    expect(guessActivityType("Réunion de parents")).toBe("Réunion");
    expect(guessActivityType("Pratique U12 F")).toBe("Pratique");
    expect(guessActivityType("Entraînement gardiennes")).toBe("Pratique");
  });

  it("heures en français", () => {
    expect(timeLabel("18:00")).toBe("18 h");
    expect(timeLabel("19:25")).toBe("19 h 25");
    expect(timeLabel(null)).toBe("");
  });

  it("fin d'une activité créée : celle lue, sinon une heure après", () => {
    expect(activityEnd("18:00", "19:25")).toBe("19:25");
    expect(activityEnd("18:00", null)).toBe("19:00");
    expect(activityEnd("23:30", null)).toBe("23:59");
    expect(activityEnd("18:00", "17:00")).toBe("19:00");
  });
});

describe("comparaison des deux calendriers", () => {
  it("identiques : même jour, même heure, même lieu écrit autrement", () => {
    const r = compareCalendars(
      [ev({ title: "Pratique U12 F", location: "École de la Voltige, 191 rue Saint-Pierre, Sainte-Thérèse" })],
      [adm({ title: "Filles 2014, 2015", location: "Sainte-Thérèse" })]
    );
    expect(r.identical).toHaveLength(1);
    expect(r.differences).toEqual([]);
    expect(r.onlyMcs).toEqual([]);
    expect(r.onlyAdmin).toEqual([]);
  });

  it("début à 10 minutes près : rapproché, mais signalé comme différence d'heure", () => {
    const r = compareCalendars([ev({ start: "18:10", end: "19:25" })], [adm({ start: "18:00", end: "19:25" })]);
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].diffs).toEqual(["debut"]);
  });

  it("fin différente seulement", () => {
    const r = compareCalendars([ev({ end: "19:30" })], [adm({ end: "19:25" })]);
    expect(r.differences[0].diffs).toEqual(["fin"]);
  });

  it("même heure, autre lieu : différence de lieu", () => {
    const r = compareCalendars([ev({ location: "École Chambéry, Blainville" })], [adm({ location: "École des Falaises, Prévost" })]);
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].diffs).toEqual(["lieu"]);
  });

  it("pratique déplacée d'une heure au même endroit : différence d'heure", () => {
    const r = compareCalendars([ev({ start: "19:30", end: "20:55", location: "Sainte-Thérèse" })], [adm({ start: "18:00", end: "19:25", location: "Sainte-Thérèse" })]);
    expect(r.differences).toHaveLength(1);
    expect(r.differences[0].diffs).toEqual(["debut", "fin"]);
  });

  it("d'un seul côté : à créer dans l'admin ou à importer dans MonClubSportif", () => {
    const r = compareCalendars([ev({ date: "2026-11-10", title: "Tournoi de Noël" })], [adm({ date: "2026-11-11" })]);
    expect(r.onlyMcs.map((e) => e.title)).toEqual(["Tournoi de Noël"]);
    expect(r.onlyAdmin).toHaveLength(1);
  });

  it("deux groupes à la même heure au même endroit : chacun avec le bon", () => {
    const r = compareCalendars(
      [ev({ title: "U10 F 2016-2017", location: "Sainte-Thérèse", start: "18:00" }), ev({ title: "U12 F 2014-2015", location: "Sainte-Thérèse", start: "18:00" })],
      [adm({ title: "Filles 2014, 2015", location: "Sainte-Thérèse" }), adm({ title: "Filles 2016, 2017", location: "Sainte-Thérèse" })]
    );
    expect(r.identical).toHaveLength(2);
    for (const p of r.identical) expect(birthYears(p.mcs.title, 2026)[0]).toBe(birthYears(p.admin.title, 2026)[0]);
  });

  it("deux groupes d'âge différents ne sont jamais rapprochés", () => {
    const r = compareCalendars([ev({ title: "Pratique 2012" })], [adm({ title: "Filles 2016, 2017" })]);
    expect(r.identical).toEqual([]);
    expect(r.differences).toEqual([]);
    expect(r.onlyMcs).toHaveLength(1);
    expect(r.onlyAdmin).toHaveLength(1);
  });

  it("préfère la paire exacte à une paire approximative", () => {
    const r = compareCalendars([ev({ start: "18:00", location: "Sainte-Thérèse" })], [adm({ start: "18:10", location: "Sainte-Thérèse" }), adm({ start: "18:00", location: "Sainte-Thérèse" })]);
    expect(r.identical).toHaveLength(1);
    expect(r.onlyAdmin.map((e) => e.start)).toEqual(["18:10"]);
  });

  it("au-delà de 4 h d'écart, ce ne sont plus les mêmes activités", () => {
    const r = compareCalendars([ev({ start: "09:00", end: "10:00", location: "Sainte-Thérèse" })], [adm({ start: "18:00", location: "Sainte-Thérèse" })]);
    expect(r.differences).toEqual([]);
    expect(r.onlyMcs).toHaveLength(1);
  });

  it("de bout en bout : calendrier iCal développé contre l'horaire de l'admin", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:l",
      "SUMMARY:Pratique U12 F 2014-2015",
      "LOCATION:École de la Voltige\\, Sainte-Thérèse",
      "DTSTART;TZID=America/Toronto:20261102T180000",
      "DTEND;TZID=America/Toronto:20261102T192500",
      "RRULE:FREQ=WEEKLY;COUNT=3",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:t",
      "SUMMARY:Festival de soccer",
      "DTSTART;TZID=America/Toronto:20261114T090000",
      "DTEND;TZID=America/Toronto:20261114T150000",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const mcs = expandEvents(parseIcal(ics).events, { from: "2026-11-02", to: "2026-11-22" }).map(mcsEventFromOccurrence);
    const admin = ["2026-11-02", "2026-11-09", "2026-11-16"].map((d, i) => adm({ date: d, title: "Filles 2014, 2015", location: "Sainte-Thérèse", start: i === 2 ? "19:30" : "18:00", end: i === 2 ? "20:55" : "19:25" }));
    const r = compareCalendars(mcs, admin);
    expect(r.identical.map((p) => p.mcs.date)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(r.differences.map((p) => [p.mcs.date, p.diffs])).toEqual([["2026-11-16", ["debut", "fin"]]]);
    expect(r.onlyMcs.map((e) => [e.date, e.type])).toEqual([["2026-11-14", "Tournoi"]]);
  });
});

describe("calendrier de l'admin", () => {
  const practice = (over: Partial<Practice>): Practice => ({
    key: "tpl-1-2026-11-09",
    date: "2026-11-09",
    start: "18:00",
    end: "19:25",
    group: "Filles 2014, 2015",
    location: "Sainte-Thérèse",
    source: "saison",
    organization: null,
    activityId: null,
    activityType: "Pratique",
    blocks: 0,
    theme: null,
    preparedDaysAhead: null,
    readiness: "vert",
    daysLeft: 7,
    ...over
  });
  const match = (over: Partial<MatchRow>): MatchRow => ({
    id: "m1",
    date: "2026-11-08",
    start: "17:30",
    end: "18:30",
    location: "Complexe sportif Terrebonne",
    field: "Terrain n° 4",
    format: "9 c 9",
    ourTeam: "New Valkyria — Équipe 2015 avancé (filles)",
    opponent: "FC Laval · U11 F",
    bookingStatus: "paid",
    revenueCents: 0,
    balanceDueCents: 0,
    refereesNeeded: 2,
    refereeFeeCents: 5000,
    fieldCostCents: 18650,
    coachCostCents: 4000,
    assignments: [],
    ...over
  });

  it("garde les pratiques de l'Académie et les matchs vendus, pas les pratiques hors Académie ni les plages à vendre", () => {
    const out = adminEventsFrom(
      [practice({}), practice({ key: "act-x", organization: "CF Montréal", source: "activite" }), practice({ key: "act-y", activityId: "abc", source: "activite", activityType: "Tournoi", group: "Coupe Laval" })],
      [match({}), match({ id: "m2", bookingStatus: null, opponent: null })],
      { from: "2026-11-02", to: "2026-12-13" }
    );
    expect(out.map((e) => [e.date, e.title, e.href])).toEqual([
      ["2026-11-08", "Match Équipe 2015 avancé (filles) contre FC Laval · U11 F", "/admin/matchs"],
      ["2026-11-09", "Filles 2014, 2015", "/admin/saison?vue=horaire"],
      ["2026-11-09", "Tournoi · Coupe Laval", "/admin/entraineurs/activites/abc"]
    ]);
  });

  it("un match vendu déjà entré comme activité Match n'est compté qu'une fois", () => {
    const out = adminEventsFrom([practice({ key: "act-m", date: "2026-11-08", start: "17:30", activityType: "Match", activityId: "m", source: "activite", group: "2015 avancé" })], [match({})], { from: "2026-11-02", to: "2026-12-13" });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("Match");
  });
});

describe("lien iCal", () => {
  it("accepte https et webcal, refuse le reste", () => {
    expect(normalizeIcalUrl("webcal://www.monclubsportif.com/calendrier/abc123.ics")).toEqual({ ok: true, url: "https://www.monclubsportif.com/calendrier/abc123.ics" });
    expect(normalizeIcalUrl("  https://calendar.google.com/calendar/ical/x%40group.calendar.google.com/private-abc/basic.ics ")).toMatchObject({ ok: true });
    expect(normalizeIcalUrl("monclubsportif.com/ical/abc")).toEqual({ ok: true, url: "https://monclubsportif.com/ical/abc" });
    expect(normalizeIcalUrl("")).toMatchObject({ ok: false });
    expect(normalizeIcalUrl("ftp://exemple.com/cal.ics")).toMatchObject({ ok: false });
    expect(normalizeIcalUrl("http://localhost:3000/api/calendar/x")).toMatchObject({ ok: false });
    expect(normalizeIcalUrl("http://192.168.0.10/cal.ics")).toMatchObject({ ok: false });
    expect(normalizeIcalUrl("pas un lien")).toMatchObject({ ok: false });
  });

  it("ne montre jamais le lien complet", () => {
    expect(maskIcalUrl("https://www.monclubsportif.com/ical/secret-token-9f3a.ics")).toBe("www.monclubsportif.com · ….ics");
    expect(maskIcalUrl("https://exemple.com/cal?key=abcdef1234")).toBe("exemple.com · …1234");
    expect(maskIcalUrl("pas un lien")).toBe("lien enregistré");
  });
});

describe("téléchargement", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lit un calendrier", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", { headers: { "content-type": "text/calendar; charset=utf-8" } })));
    await expect(fetchIcalText("https://exemple.com/cal.ics")).resolves.toContain("BEGIN:VCALENDAR");
  });

  it("explique une page Web à la place d'un calendrier", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html><html><body>Connexion</body></html>", { headers: { "content-type": "text/html" } })));
    await expect(fetchIcalText("https://exemple.com/cal")).rejects.toThrow(/page Web, pas un calendrier/);
  });

  it("explique un lien expiré ou introuvable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("non", { status: 404 })));
    await expect(fetchIcalText("https://exemple.com/cal.ics")).rejects.toThrow(/n'existe plus/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("non", { status: 403 })));
    await expect(fetchIcalText("https://exemple.com/cal.ics")).rejects.toThrow(/refuse l'accès/);
  });

  it("abandonne après le délai", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          })
      )
    );
    await expect(fetchIcalText("https://exemple.com/lent.ics", 50)).rejects.toThrow(/n'a pas répondu en 0 secondes|n'a pas répondu/);
  });
});

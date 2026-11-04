// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "@/lib/calendar-repo";
import {
  decodeIcalBytes,
  expandEvents,
  generateICS,
  looksLikeIcal,
  parseContentLine,
  parseDuration,
  parseIcal,
  readIcalWindow,
  unescapeText,
  unfoldLines,
  wallInZone,
  zonedToUtc
} from "@/lib/ical";

const crlf = (lines: string[]) => lines.join("\r\n") + "\r\n";

/** Calendrier réaliste (style Google / MonClubSportif) : VTIMEZONE, série hebdomadaire lundi et
 *  mercredi qui traverse le passage à l'heure normale du 1er novembre 2026, une exception,
 *  une occurrence déplacée, un match en UTC, un congé sur deux jours. */
const CLUB_FEED = crlf([
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//MonClubSportif//Calendrier//FR",
  "CALSCALE:GREGORIAN",
  "METHOD:PUBLISH",
  "X-WR-CALNAME:New Valkyria – Filles",
  "X-WR-TIMEZONE:America/Toronto",
  "BEGIN:VTIMEZONE",
  "TZID:America/Toronto",
  "X-LIC-LOCATION:America/Toronto",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "DTSTART;TZID=America/Toronto:20261026T180000",
  "DTEND;TZID=America/Toronto:20261026T192500",
  "RRULE:FREQ=WEEKLY;UNTIL=20261210T045959Z;BYDAY=MO,WE",
  "EXDATE;TZID=America/Toronto:20261111T180000",
  "DTSTAMP:20261020T120000Z",
  "UID:pratique-u12@monclubsportif.com",
  "SUMMARY:Pratique Filles 2014\\, 2015",
  "LOCATION:École de la Voltige\\, 191 rue Saint-Pierre\\, Sainte-Thérèse",
  "DESCRIPTION:Apporter ballon et gourde.\\nArrivée 10 minutes avant. Les parents ",
  " restent dans le hall.",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "DESCRIPTION:Rappel",
  "TRIGGER:-PT1H",
  "END:VALARM",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:pratique-u12@monclubsportif.com",
  "RECURRENCE-ID;TZID=America/Toronto:20261118T180000",
  "DTSTART;TZID=America/Toronto:20261118T190000",
  "DTEND;TZID=America/Toronto:20261118T202500",
  "SUMMARY:Pratique Filles 2014\\, 2015 (déplacée)",
  "LOCATION:École de la Voltige\\, Sainte-Thérèse",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:match-2026-11-08@monclubsportif.com",
  "DTSTART:20261108T223000Z",
  "DTEND:20261108T233000Z",
  "SUMMARY:Match 2015 avancé vs FC Laval",
  "LOCATION:Complexe sportif Terrebonne",
  "CATEGORIES:Match,Compétition",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:conge-fetes@monclubsportif.com",
  "DTSTART;VALUE=DATE:20261224",
  "DTEND;VALUE=DATE:20261226",
  "SUMMARY:Congé des Fêtes",
  "END:VEVENT",
  "END:VCALENDAR"
]);

describe("lignes et propriétés", () => {
  it("déplie les lignes repliées (espace ou tabulation) en CRLF ou LF", () => {
    expect(unfoldLines("SUMMARY:Pratique \r\n  du lundi\r\nLOCATION:Gym\r\n")).toEqual(["SUMMARY:Pratique  du lundi", "LOCATION:Gym"]);
    expect(unfoldLines("DESCRIPTION:a\n\tb\nUID:1")).toEqual(["DESCRIPTION:ab", "UID:1"]);
  });

  it("lit les paramètres, même entre guillemets avec deux-points", () => {
    expect(parseContentLine('DTSTART;TZID="America/Toronto":20261105T183000')).toEqual({ name: "DTSTART", params: { TZID: "America/Toronto" }, value: "20261105T183000" });
    const att = parseContentLine('ATTENDEE;CN="Durand: Christine";ROLE=REQ-PARTICIPANT:mailto:c@example.com');
    expect(att?.params.CN).toBe("Durand: Christine");
    expect(att?.value).toBe("mailto:c@example.com");
    expect(parseContentLine("item1.X-ABLABEL:Bureau")?.name).toBe("X-ABLABEL");
    expect(parseContentLine("ceci n'est pas une propriété")).toBeNull();
  });

  it("enlève les échappements de texte", () => {
    expect(unescapeText("Pratique U12\\, filles\; groupe A\\nTerrain 2\\\\B")).toBe("Pratique U12, filles; groupe A\nTerrain 2\\B");
  });

  it("lit les durées", () => {
    expect(parseDuration("PT1H30M")).toBe(90 * 60_000);
    expect(parseDuration("P1D")).toBe(86_400_000);
    expect(parseDuration("P1W")).toBe(7 * 86_400_000);
    expect(parseDuration("-PT15M")).toBe(-15 * 60_000);
    expect(parseDuration("P")).toBeNull();
    expect(parseDuration("PT")).toBeNull();
    expect(parseDuration("1 heure")).toBeNull();
  });

  it("recolle un caractère accentué coupé par un repli, au niveau des octets", () => {
    const enc = new TextEncoder().encode("SUMMARY:Pratique à Sainte-Thérèse\r\n");
    // « é » = C3 A9 : on insère un repli CRLF + espace au milieu du caractère
    const idx = enc.findIndex((b, i) => b === 0xc3 && enc[i + 1] === 0xa9);
    const folded = new Uint8Array([...enc.slice(0, idx + 1), 0x0d, 0x0a, 0x20, ...enc.slice(idx + 1)]);
    expect(decodeIcalBytes(folded)).toBe("SUMMARY:Pratique à Sainte-Thérèse\r\n");
  });

  it("décode un fichier en Windows-1252 quand il n'est pas en UTF-8", () => {
    const latin = new Uint8Array([...new TextEncoder().encode("SUMMARY:Th"), 0xe9, ...new TextEncoder().encode("r")]);
    expect(decodeIcalBytes(latin)).toBe("SUMMARY:Thér");
    expect(decodeIcalBytes(latin, "iso-8859-1")).toBe("SUMMARY:Thér");
  });

  it("reconnaît un calendrier", () => {
    expect(looksLikeIcal(CLUB_FEED)).toBe(true);
    expect(looksLikeIcal("<!doctype html><html>Connexion</html>")).toBe(false);
  });
});

describe("fuseaux horaires", () => {
  it("convertit l'heure de Montréal en UTC, avant et après le changement d'heure", () => {
    expect(new Date(zonedToUtc({ y: 2026, m: 10, d: 26, h: 18, mi: 0, s: 0 }, "America/Toronto")).toISOString()).toBe("2026-10-26T22:00:00.000Z");
    expect(new Date(zonedToUtc({ y: 2026, m: 11, d: 2, h: 18, mi: 0, s: 0 }, "America/Toronto")).toISOString()).toBe("2026-11-02T23:00:00.000Z");
    expect(wallInZone(Date.UTC(2026, 10, 8, 22, 30), "America/Toronto")).toMatchObject({ y: 2026, m: 11, d: 8, h: 17, mi: 30 });
  });
});

describe("lecture d'un calendrier réaliste", () => {
  const cal = parseIcal(CLUB_FEED);

  it("lit le nom, le fuseau et les événements (sans les rappels)", () => {
    expect(cal.name).toBe("New Valkyria – Filles");
    expect(cal.timezone).toBe("America/Toronto");
    expect(cal.events).toHaveLength(4);
    expect(cal.warnings).toEqual([]);
    const p = cal.events[0];
    expect(p.summary).toBe("Pratique Filles 2014, 2015");
    expect(p.location).toBe("École de la Voltige, 191 rue Saint-Pierre, Sainte-Thérèse");
    expect(p.description).toBe("Apporter ballon et gourde.\nArrivée 10 minutes avant. Les parents restent dans le hall.");
    expect(p.rrule).toMatchObject({ freq: "WEEKLY", interval: 1, count: null, byday: [{ n: null, wd: 1 }, { n: null, wd: 3 }] });
    expect(p.durationMs).toBe(85 * 60_000);
    expect(cal.events[2].categories).toEqual(["Match", "Compétition"]);
  });

  it("développe la série à la même heure locale malgré le changement d'heure, sans l'exception, avec l'occurrence déplacée", () => {
    const occ = expandEvents(cal.events, { from: "2026-10-26", to: "2026-11-22" });
    const practices = occ.filter((o) => o.uid === "pratique-u12@monclubsportif.com");
    expect(practices.map((o) => `${o.date} ${o.start}-${o.end}`)).toEqual([
      "2026-10-26 18:00-19:25",
      "2026-10-28 18:00-19:25",
      "2026-11-02 18:00-19:25",
      "2026-11-04 18:00-19:25",
      "2026-11-09 18:00-19:25",
      // 11 nov. : exception (EXDATE)
      "2026-11-16 18:00-19:25",
      "2026-11-18 19:00-20:25"
    ]);
    expect(practices.at(-1)?.summary).toBe("Pratique Filles 2014, 2015 (déplacée)");
    expect(practices.every((o) => o.recurring && !o.allDay)).toBe(true);
  });

  it("respecte UNTIL (dernier mercredi le 9 décembre)", () => {
    const occ = expandEvents(cal.events, { from: "2026-12-01", to: "2026-12-31" }).filter((o) => o.uid.startsWith("pratique"));
    expect(occ.map((o) => o.date)).toEqual(["2026-12-02", "2026-12-07", "2026-12-09"]);
  });

  it("rend une heure UTC (Z) dans le fuseau du club", () => {
    const [match] = expandEvents(cal.events, { from: "2026-11-08", to: "2026-11-08" });
    expect(match).toMatchObject({ summary: "Match 2015 avancé vs FC Laval", date: "2026-11-08", start: "17:30", end: "18:30", recurring: false });
  });

  it("garde une journée entière sur ses dates (fin exclusive dans le fichier)", () => {
    const occ = expandEvents(cal.events, { from: "2026-12-25", to: "2026-12-31" });
    expect(occ).toHaveLength(1);
    expect(occ[0]).toMatchObject({ allDay: true, date: "2026-12-24", endDate: "2026-12-25", start: null, end: null });
  });

  it("n'inclut rien hors de la fenêtre", () => {
    expect(expandEvents(cal.events, { from: "2027-01-05", to: "2027-01-31" })).toEqual([]);
  });
});

describe("répétitions", () => {
  const one = (lines: string[], window: { from: string; to: string }) =>
    readIcalWindow(crlf(["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", "UID:x", "SUMMARY:Test", ...lines, "END:VEVENT", "END:VCALENDAR"]), window);

  it("COUNT compte la première date et les exceptions", () => {
    const { occurrences } = one(["DTSTART;TZID=America/Toronto:20261105T183000", "DURATION:PT1H15M", "RRULE:FREQ=WEEKLY;COUNT=4", "EXDATE;TZID=America/Toronto:20261112T183000"], { from: "2026-11-01", to: "2027-01-31" });
    expect(occurrences.map((o) => `${o.date} ${o.start}-${o.end}`)).toEqual(["2026-11-05 18:30-19:45", "2026-11-19 18:30-19:45", "2026-11-26 18:30-19:45"]);
  });

  it("INTERVAL=2 aux deux semaines, avec plusieurs jours", () => {
    const { occurrences } = one(["DTSTART;TZID=America/Toronto:20261102T170000", "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH"], { from: "2026-11-01", to: "2026-11-30" });
    expect(occurrences.map((o) => o.date)).toEqual(["2026-11-02", "2026-11-05", "2026-11-16", "2026-11-19", "2026-11-30"]);
  });

  it("DAILY avec UNTIL en date seule", () => {
    const { occurrences } = one(["DTSTART:20261228T090000", "DTEND:20261228T120000", "RRULE:FREQ=DAILY;UNTIL=20261230"], { from: "2026-12-01", to: "2027-01-31" });
    expect(occurrences.map((o) => `${o.date} ${o.start}`)).toEqual(["2026-12-28 09:00", "2026-12-29 09:00", "2026-12-30 09:00"]);
  });

  it("MONTHLY le 2e samedi", () => {
    const { occurrences } = one(["DTSTART;TZID=America/Toronto:20261114T100000", "RRULE:FREQ=MONTHLY;BYDAY=2SA;COUNT=3"], { from: "2026-11-01", to: "2027-03-31" });
    expect(occurrences.map((o) => o.date)).toEqual(["2026-11-14", "2026-12-12", "2027-01-09"]);
  });

  it("MONTHLY le dernier jour du mois", () => {
    const { occurrences } = one(["DTSTART;VALUE=DATE:20261130", "RRULE:FREQ=MONTHLY;BYMONTHDAY=-1;COUNT=3"], { from: "2026-11-01", to: "2027-03-31" });
    expect(occurrences.map((o) => o.date)).toEqual(["2026-11-30", "2026-12-31", "2027-01-31"]);
  });

  it("une série commencée il y a longtemps est développée seulement sur la fenêtre", () => {
    const { occurrences } = one(["DTSTART;TZID=America/Toronto:20200106T180000", "DTEND;TZID=America/Toronto:20200106T193000", "RRULE:FREQ=WEEKLY;BYDAY=MO"], { from: "2026-11-01", to: "2026-11-15" });
    expect(occurrences.map((o) => `${o.date} ${o.start}`)).toEqual(["2026-11-02 18:00", "2026-11-09 18:00"]);
  });

  it("RDATE ajoute des dates à la série", () => {
    const { occurrences } = one(["DTSTART;TZID=America/Toronto:20261105T183000", "RRULE:FREQ=WEEKLY;COUNT=2", "RDATE;TZID=America/Toronto:20261121T100000"], { from: "2026-11-01", to: "2026-11-30" });
    expect(occurrences.map((o) => `${o.date} ${o.start}`)).toEqual(["2026-11-05 18:30", "2026-11-12 18:30", "2026-11-21 10:00"]);
  });

  it("une règle non prise en charge garde la première date et le signale", () => {
    const { occurrences, warnings } = one(["DTSTART;TZID=America/Toronto:20261105T183000", "RRULE:FREQ=MONTHLY;BYDAY=MO,TU;BYSETPOS=-1"], { from: "2026-11-01", to: "2027-01-31" });
    expect(occurrences).toHaveLength(1);
    expect(warnings[0]).toMatch(/Répétition non prise en charge/);
  });

  it("une occurrence annulée (STATUS:CANCELLED) est marquée", () => {
    const text = crlf([
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:s",
      "SUMMARY:Pratique",
      "DTSTART;TZID=America/Toronto:20261105T183000",
      "RRULE:FREQ=WEEKLY;COUNT=3",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:s",
      "RECURRENCE-ID;TZID=America/Toronto:20261112T183000",
      "DTSTART;TZID=America/Toronto:20261112T183000",
      "SUMMARY:Pratique",
      "STATUS:CANCELLED",
      "END:VEVENT",
      "END:VCALENDAR"
    ]);
    const { occurrences } = readIcalWindow(text, { from: "2026-11-01", to: "2026-11-30" });
    expect(occurrences.map((o) => [o.date, o.cancelled])).toEqual([
      ["2026-11-05", false],
      ["2026-11-12", true],
      ["2026-11-19", false]
    ]);
  });
});

describe("fuseaux écrits autrement", () => {
  const at = (dtstart: string, extra: string[] = []) =>
    readIcalWindow(crlf(["BEGIN:VCALENDAR", ...extra, "BEGIN:VEVENT", "UID:t", "SUMMARY:T", dtstart, "END:VEVENT", "END:VCALENDAR"]), { from: "2026-11-01", to: "2026-11-30" });

  it("chemin Mozilla, nom Windows, guillemets", () => {
    expect(at("DTSTART;TZID=/mozilla.org/20050126_1/America/New_York:20261105T183000").occurrences[0].start).toBe("18:30");
    expect(at("DTSTART;TZID=Eastern Standard Time:20261105T183000").occurrences[0].start).toBe("18:30");
    expect(at('DTSTART;TZID="America/Toronto":20261105T183000').occurrences[0].start).toBe("18:30");
    expect(at("DTSTART;TZID=Europe/Paris:20261105T183000").occurrences[0].start).toBe("12:30");
  });

  it("VTIMEZONE au nom inventé : reconnu par son décalage d'hiver", () => {
    const vt = ["BEGIN:VTIMEZONE", "TZID:Fuseau du club", "BEGIN:STANDARD", "TZOFFSETTO:-0500", "END:STANDARD", "BEGIN:DAYLIGHT", "TZOFFSETTO:-0400", "END:DAYLIGHT", "END:VTIMEZONE"];
    const r = at("DTSTART;TZID=Fuseau du club:20261105T183000", vt);
    expect(r.occurrences[0].start).toBe("18:30");
    expect(r.warnings).toEqual([]);
  });

  it("fuseau inconnu : heure du club et avertissement", () => {
    const r = at("DTSTART;TZID=Planète Mars:20261105T183000");
    expect(r.occurrences[0].start).toBe("18:30");
    expect(r.warnings[0]).toMatch(/Fuseau horaire inconnu/);
  });

  it("heure flottante : fuseau du calendrier (X-WR-TIMEZONE)", () => {
    expect(at("DTSTART:20261105T183000", ["X-WR-TIMEZONE:Europe/Paris"]).occurrences[0].start).toBe("12:30");
    expect(at("DTSTART:20261105T183000").occurrences[0].start).toBe("18:30");
  });
});

describe("robustesse", () => {
  it("ignore un événement sans date et une date illisible, sans planter", () => {
    const text = crlf(["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:a", "SUMMARY:Sans date", "END:VEVENT", "BEGIN:VEVENT", "UID:b", "SUMMARY:Mauvaise", "DTSTART:2026-13-45", "END:VEVENT", "END:VCALENDAR"]);
    const cal = parseIcal(text);
    expect(cal.events).toEqual([]);
    expect(cal.warnings).toHaveLength(2);
  });

  it("fichier vide ou tronqué", () => {
    expect(parseIcal("").events).toEqual([]);
    const cut = parseIcal("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:z\r\nDTSTART:20261105T183000Z\r\nSUMMARY:Coupé");
    expect(cut.events).toHaveLength(1);
  });

  it("relit le flux iCal produit par le site (generateICS)", () => {
    const events: CalendarEvent[] = [
      { id: "1", date: "2026-11-05", startTime: "18:30:00", endTime: "19:45:00", kind: "activite", activityType: "Pratique", title: "Pratique Filles 2014, 2015; groupe A", location: "École des Falaises, Prévost", terrainId: null, category: null, coachNames: null },
      { id: "2", date: "2026-11-07", startTime: null, endTime: null, kind: "essai", activityType: null, title: "Essai : une joueuse au nom très long qui dépasse soixante-quinze caractères pour forcer un repli", location: null, terrainId: null, category: null, coachNames: null }
    ];
    const { occurrences } = readIcalWindow(generateICS(events), { from: "2026-11-01", to: "2026-11-30" });
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0]).toMatchObject({ date: "2026-11-05", start: "18:30", end: "19:45", summary: "Pratique Filles 2014, 2015; groupe A", location: "École des Falaises, Prévost" });
    expect(occurrences[1]).toMatchObject({ allDay: true, date: "2026-11-07", summary: events[1].title });
  });
});

import { describe, expect, it } from "vitest";

import type { PayLine } from "@/lib/coach-pay";
import { coachPartDone, countsInPay, dayFr, hoursFr, payBank, practiceConfirmEmail } from "@/lib/coach-pay-core";

const l = (date: string, state: PayLine["state"], hours: number, cents: number, paid = false): PayLine => ({ activityId: "a", date, start: "18:00", end: "19:25", label: "x", hours, cents, state, paid });

describe("séances enlevées de la paie", () => {
  it("absent, annulé ou remplacé et pas payé : enlevé", () => {
    expect(countsInPay({ attendance: "absent", paid: false })).toBe(false);
    expect(countsInPay({ attendance: "cancelled", paid: false })).toBe(false);
    expect(countsInPay({ attendance: "replaced" })).toBe(false);
  });
  it("présent : gardé ; déjà payé : toujours gardé", () => {
    expect(countsInPay({ attendance: "present", paid: false })).toBe(true);
    expect(countsInPay({ attendance: "absent", paid: true })).toBe(true);
  });
});

describe("banque d'heures", () => {
  // 25 nov. 2026 : paie du vendredi 27 nov. (du 8 au 21 nov.), puis du 11 déc. (du 22 nov. au 5 déc.).
  const lines = [
    l("2026-10-26", "compte", 2, 5000, true),
    l("2026-11-16", "compte", 2.83, 7083),
    l("2026-11-18", "retenu", 1, 2500),
    l("2026-11-23", "compte", 2.83, 7083),
    l("2026-11-26", "prevu", 2.5, 6250),
    l("2026-12-07", "prevu", 1.42, 3542),
    l("2026-11-17", "absent", 0, 0)
  ];
  const b = payBank(lines, "2026-11-25");
  it("la paie en cours et la suivante", () => {
    expect(b.current.payDate).toBe("2026-11-27");
    expect(b.current.earnedHours).toBe(2.83);
    expect(b.current.heldCents).toBe(2500);
    expect(b.current.totalCents).toBe(9583);
    expect(b.next.payDate).toBe("2026-12-11");
    expect(b.next.from).toBe("2026-11-22");
    expect(b.next.earnedCents).toBe(7083);
    expect(b.next.plannedCents).toBe(6250);
    expect(b.next.totalHours).toBe(5.33);
  });
  it("accumulé, versé, à recevoir et à venir", () => {
    expect(b.accumulated).toEqual({ hours: 7.66, cents: 19166 });
    expect(b.paid.cents).toBe(5000);
    expect(b.owed.cents).toBe(14166);
    expect(b.upcoming).toEqual({ hours: 4.92, cents: 12292 });
  });
  it("rien du tout : des zéros", () => {
    const e = payBank([], "2026-11-25");
    expect(e.current.totalCents).toBe(0);
    expect(e.accumulated.hours).toBe(0);
  });
});

describe("part du rapport finie", () => {
  const ok = { required: true, complete: true, debriefDone: ["c1"] };
  it("coach : rapport complet et son retour 2 + 2", () => {
    expect(coachPartDone(ok, "c1", true)).toBe(true);
    expect(coachPartDone(ok, "c2", true)).toBe(false);
  });
  it("assistant : le rapport de la pratique suffit", () => {
    expect(coachPartDone(ok, "c2", false)).toBe(true);
    expect(coachPartDone({ ...ok, complete: false }, "c2", false)).toBe(false);
    expect(coachPartDone({ required: false, complete: true }, "c2", false)).toBe(false);
    expect(coachPartDone(null, "c2", false)).toBe(false);
  });
});

describe("courriel de confirmation", () => {
  const base = { firstName: "Maéva", reportHour: null, pendingToday: 0, hasReportHour: true, payDate: "2026-12-11", bank: { hours: 6.5, cents: 26000 }, siteUrl: "https://www.newvalkyria.com" };
  const p1 = { date: "2026-11-25", start: "18:00", end: "19:25", label: "Filles 2016-2017", hours: 85 / 60, cents: 5667, counted: true };
  const p2 = { date: "2026-11-25", start: "19:30", end: "20:55", label: "Filles 2014-2015 avancé", hours: 85 / 60, cents: 5667, counted: false };

  it("une pratique, il en reste une pour l'heure de rapport", () => {
    const m = practiceConfirmEmail({ ...base, practices: [p1], pendingToday: 1 });
    expect(m.subject).toBe("Rapport enregistré : mercredi 25 novembre · 1 h 25 dans ta paie");
    expect(m.text).toContain("Ton rapport du mercredi 25 novembre est bien enregistré");
    expect(m.text).toContain("1 h 25 de terrain (56,67 $)");
    expect(m.text).toContain("Encore 1 rapport à finir aujourd'hui");
    expect(m.text).toContain("paie du vendredi 11 décembre : ta banque pour cette paie est rendue à 6 h 30 (260,00 $)");
    expect(m.html).toContain("https://www.newvalkyria.com/entraineur/paie");
  });
  it("journée finie : l'heure de rapport est annoncée dans le même courriel", () => {
    const m = practiceConfirmEmail({ ...base, practices: [p2], reportHour: { hours: 1, cents: 4000, counted: false } });
    expect(m.subject).toContain("2 h 25 dans ta paie");
    expect(m.text).toContain("Heure de rapport du jour : 1 h (40,00 $)");
    expect(m.text).toContain("Tous tes rapports de la journée sont finis");
    expect(m.text).toContain("comptées dès que ta présence est confirmée dans MonClubSportif");
    expect(m.text).toContain("Ces heures entreront dans ta paie du vendredi 11 décembre");
  });
  it("deux pratiques d'un coup : un seul courriel", () => {
    const m = practiceConfirmEmail({ ...base, hasReportHour: false, practices: [p1, p2] });
    expect(m.subject.startsWith("2 rapports enregistrés")).toBe(true);
    expect(m.text).not.toContain("heure de rapport");
  });
  it("formats", () => {
    expect(dayFr("2026-12-01")).toBe("mardi 1er décembre");
    expect(hoursFr(2.8333)).toBe("2 h 50");
    expect(hoursFr(1)).toBe("1 h");
  });
});

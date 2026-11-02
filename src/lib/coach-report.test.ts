import { describe, expect, it } from "vitest";

import { activityEndMs, checkNote, computeReport, feedbackByWeek, isQuickEvaluationComplete, noteSimilarity, payHold } from "@/lib/coach-report";

const fullRatings = { "Ball mastery": 4, Prestation: 3, Attitude: 5 };

describe("checkNote", () => {
  const base = { playerFirstName: "Léa", sameActivity: [], previous: [] };

  it("refuse une note de moins de 30 caractères et dit combien il en manque", () => {
    const r = checkNote({ ...base, note: "Bonne pratique." });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("trop-court");
    expect(r.message).toContain("Encore 15 caractères");
    expect(r.message).toContain("Léa");
  });

  it("accepte une vraie note", () => {
    expect(checkNote({ ...base, note: "Souriante, elle a aidé une coéquipière au 1 contre 1 et posé de bonnes questions." }).ok).toBe(true);
  });

  it("refuse une note qui se répète", () => {
    expect(checkNote({ ...base, note: "bien bien bien bien bien bien bien bien bien" }).code).toBe("repetitif");
    expect(checkNote({ ...base, note: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }).code).toBe("repetitif");
  });

  it("refuse le même texte que pour une autre fille, même avec le prénom changé", () => {
    const r = checkNote({
      ...base,
      note: "Léa était concentrée, a bien écouté les consignes et a encouragé son équipe.",
      sameActivity: [{ playerName: "Mia", note: "Mia était concentrée, a bien écouté les consignes et a encouragé son équipe." }]
    });
    expect(r.code).toBe("autre-joueuse");
    expect(r.message).toContain("celle de Mia");
    expect(r.message).toContain("qu'est-ce que Léa");
  });

  it("fait l'élision devant une voyelle", () => {
    const r = checkNote({ ...base, playerFirstName: "Alexia", note: "Concentrée, elle a bien écouté les consignes et a encouragé son équipe.", sameActivity: [{ playerName: "Amaliah R.", note: "Concentrée, elle a bien écouté les consignes et a encouragé son équipe." }] });
    expect(r.message).toContain("celle d'Amaliah R.");
    expect(r.message).toContain("qu'est-ce qu'Alexia");
  });

  it("refuse une note identique à une séance précédente", () => {
    const r = checkNote({
      ...base,
      note: "Très bonne attitude, concentrée du début à la fin, aucun problème aujourd'hui.",
      previous: [{ playerName: "Léa", date: "2026-11-09", note: "Très bonne attitude, concentrée du début à la fin, aucun problème aujourd'hui." }]
    });
    expect(r.code).toBe("seance-precedente");
    expect(r.message).toContain("9 novembre");
  });

  it("accepte deux notes différentes pour deux filles", () => {
    const r = checkNote({
      ...base,
      note: "Fatiguée en début de séance, elle s'est réveillée au jeu réduit et a marqué deux fois.",
      sameActivity: [{ playerName: "Mia", note: "Timide aujourd'hui, a eu besoin d'encouragements pour oser le dribble face à l'adversaire." }]
    });
    expect(r.ok).toBe(true);
  });
});

describe("noteSimilarity", () => {
  it("vaut 1 pour deux textes identiques et baisse quand ils diffèrent", () => {
    expect(noteSimilarity("Elle a très bien joué ce soir", "Elle a très bien joué ce soir")).toBe(1);
    expect(noteSimilarity("Elle a très bien joué ce soir", "Distraite, parlait pendant les consignes")).toBeLessThan(0.3);
  });
});

describe("isQuickEvaluationComplete", () => {
  it("demande les 3 échelles et 30 caractères", () => {
    expect(isQuickEvaluationComplete({ ratings: fullRatings, comment: "Concentrée et souriante, belle progression au contrôle." })).toBe(true);
    expect(isQuickEvaluationComplete({ ratings: { Attitude: 4 }, comment: "Concentrée et souriante, belle progression au contrôle." })).toBe(false);
    expect(isQuickEvaluationComplete({ ratings: fullRatings, comment: "Ok" })).toBe(false);
  });
});

describe("computeReport", () => {
  const roster = [
    { registrationId: "a", name: "Léa" },
    { registrationId: "b", name: "Mia" },
    { registrationId: "c", name: "Zoé" }
  ];
  const good = "Concentrée et souriante, belle progression au contrôle orienté.";

  it("liste les présences, évaluations et routines manquantes", () => {
    const r = computeReport({
      activity: { activity_type: "Pratique" },
      roster,
      attendance: [
        { registration_id: "a", status: "present", practice_rating: 9, fatigue: 6 },
        { registration_id: "b", status: "absent" }
      ],
      evaluations: [{ registration_id: "a", ratings: fullRatings, comment: good }]
    });
    expect(r.required).toBe(true);
    expect(r.attendanceMissing).toEqual(["Zoé"]);
    expect(r.evaluationsMissing).toEqual([]);
    expect(r.complete).toBe(false);
  });

  it("est complet quand chaque fille présente est évaluée (les absentes ne comptent pas)", () => {
    const r = computeReport({
      activity: { activity_type: "Pratique" },
      roster,
      attendance: [
        { registration_id: "a", status: "present" },
        { registration_id: "b", status: "absent" },
        { registration_id: "c", status: "late" }
      ],
      evaluations: [
        { registration_id: "a", ratings: fullRatings, comment: good },
        { registration_id: "c", ratings: fullRatings, comment: "Arrivée en retard mais très appliquée, a bien récupéré au jeu." }
      ]
    });
    expect(r.complete).toBe(true);
    expect(r.feedbackMissing).toEqual(["Léa", "Zoé"]);
  });

  it("ne demande pas de rapport pour une réunion ou une pratique hors Académie", () => {
    expect(computeReport({ activity: { activity_type: "Réunion" }, roster, attendance: [], evaluations: [] }).required).toBe(false);
    expect(computeReport({ activity: { activity_type: "Pratique", organization: "CF Montréal" }, roster, attendance: [], evaluations: [] }).complete).toBe(true);
  });
});

describe("payHold", () => {
  it("garde l'ancienne règle avant le 2 novembre 2026", () => {
    expect(payHold({ activityDate: "2026-10-05", status: "present", confirmed: false, report: { required: true, complete: false } })).toBeNull();
  });
  it("retient les heures tant que la présence n'est pas confirmée, puis tant que le rapport est incomplet", () => {
    expect(payHold({ activityDate: "2026-11-09", status: "present", confirmed: false, report: { required: true, complete: true } })).toBe("presence");
    expect(payHold({ activityDate: "2026-11-09", status: "present", confirmed: true, report: { required: true, complete: false } })).toBe("rapport");
    expect(payHold({ activityDate: "2026-11-09", status: "present", confirmed: true, report: { required: true, complete: true } })).toBeNull();
    expect(payHold({ activityDate: "2026-11-09", status: "absent", confirmed: false, report: null })).toBeNull();
  });
});

describe("activityEndMs", () => {
  it("tient compte de l'heure de Montréal (avant et après le changement d'heure)", () => {
    expect(new Date(activityEndMs("2026-11-09", "19:25")).toISOString()).toBe("2026-11-10T00:25:00.000Z");
    expect(new Date(activityEndMs("2026-10-05", "19:25")).toISOString()).toBe("2026-10-05T23:25:00.000Z");
  });
});

describe("feedbackByWeek", () => {
  it("fait la moyenne de la note et de la fatigue par semaine (lundi)", () => {
    const weeks = feedbackByWeek([
      { date: "2026-11-09", practice_rating: 9, fatigue: 5 },
      { date: "2026-11-11", practice_rating: 8, fatigue: 7 },
      { date: "2026-11-02", practice_rating: 10, fatigue: null },
      { date: "2026-11-03", practice_rating: null, fatigue: null }
    ]);
    expect(weeks).toEqual([
      { weekStart: "2026-11-09", count: 2, rating: 8.5, fatigue: 6 },
      { weekStart: "2026-11-02", count: 1, rating: 10, fatigue: null }
    ]);
  });
});

describe("watchReasons", () => {
  const ev = (a: number, p = 4, b = 4) => ({ date: "2026-11-09", ratings: { "Ball mastery": b, Prestation: p, Attitude: a } });
  it("ne signale rien pour une joueuse qui va bien", async () => {
    const { watchReasons } = await import("@/lib/coach-report");
    expect(watchReasons({ evaluations: [ev(4), ev(5), ev(4)], feedback: [{ date: "2026-11-09", practice_rating: 9, fatigue: 5 }] })).toEqual([]);
  });
  it("signale une attitude basse, une baisse nette, la fatigue et une pratique mal notée", async () => {
    const { watchReasons } = await import("@/lib/coach-report");
    const r = watchReasons({
      evaluations: [ev(4, 4, 5), ev(4, 4, 5), ev(5, 4, 5), ev(2, 4, 3), ev(2, 4, 3), ev(1, 4, 3)],
      feedback: [
        { date: "2026-11-09", practice_rating: 4, fatigue: 9 },
        { date: "2026-11-11", practice_rating: 5, fatigue: 8 }
      ]
    });
    expect(r.some((x) => x.startsWith("Attitude basse"))).toBe(true);
    expect(r.some((x) => x.startsWith("Attitude en baisse"))).toBe(true);
    expect(r.some((x) => x.startsWith("Ball mastery en baisse"))).toBe(true);
    expect(r.some((x) => x.startsWith("Très fatiguée"))).toBe(true);
    expect(r.some((x) => x.startsWith("N'aime pas"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { activityEndMs, checkNote, computeReport, countWords, debriefPoints, feedbackByWeek, isDebriefComplete, isQuickEvaluationComplete, noteSimilarity, dailyReportHours, payHold, reportHour, reportMissing } from "@/lib/coach-report";

const fullRatings = { "Ball mastery": 4, Prestation: 3, Attitude: 5 };

describe("checkNote", () => {
  const base = { playerFirstName: "Léa", sameActivity: [], previous: [] };

  it("refuse une observation de moins de 25 mots et dit combien il en manque", () => {
    const r = checkNote({ ...base, note: "Bonne pratique." });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("trop-court");
    expect(r.message).toContain("Encore 23 mots");
    expect(r.message).toContain("Léa");
  });

  it("accepte une vraie note", () => {
    expect(checkNote({ ...base, note: "Souriante et concentrée. Son contrôle orienté progresse, elle lève la tête plus tôt. Au 2c2, elle a cadré la porteuse et récupéré le ballon deux fois, puis elle a relancé vite vers sa partenaire." }).ok).toBe(true);
  });

  it("refuse une note qui se répète", () => {
    expect(checkNote({ ...base, note: "bien bien bien bien bien bien bien bien bien" }).code).toBe("repetitif");
    expect(checkNote({ ...base, note: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }).code).toBe("repetitif");
  });

  it("refuse le même texte que pour une autre fille, même avec le prénom changé", () => {
    const r = checkNote({
      ...base,
      note: "Léa était concentrée, a bien écouté les consignes et a encouragé son équipe. Son premier contrôle progresse beaucoup depuis deux semaines. Au rondo, elle a trouvé la passe entre les lignes.",
      sameActivity: [{ playerName: "Mia", note: "Mia était concentrée, a bien écouté les consignes et a encouragé son équipe. Son premier contrôle progresse beaucoup depuis deux semaines. Au rondo, elle a trouvé la passe entre les lignes." }]
    });
    expect(r.code).toBe("autre-joueuse");
    expect(r.message).toContain("celle de Mia");
    expect(r.message).toContain("qu'est-ce que Léa");
  });

  it("fait l'élision devant une voyelle", () => {
    const r = checkNote({ ...base, playerFirstName: "Alexia", note: "Concentrée, elle a bien écouté les consignes et a encouragé son équipe. Son premier contrôle progresse beaucoup depuis deux semaines. Au rondo, elle a trouvé la passe entre les lignes.", sameActivity: [{ playerName: "Amaliah R.", note: "Concentrée, elle a bien écouté les consignes et a encouragé son équipe. Son premier contrôle progresse beaucoup depuis deux semaines. Au rondo, elle a trouvé la passe entre les lignes." }] });
    expect(r.message).toContain("celle d'Amaliah R.");
    expect(r.message).toContain("qu'est-ce qu'Alexia");
  });

  it("refuse une note identique à une séance précédente", () => {
    const r = checkNote({
      ...base,
      note: "Très bonne attitude, concentrée du début à la fin, aucun problème aujourd'hui. Elle progresse au dribble pied gauche. Au 1c1 final, elle a éliminé son adversaire deux fois de suite.",
      previous: [{ playerName: "Léa", date: "2026-11-09", note: "Très bonne attitude, concentrée du début à la fin, aucun problème aujourd'hui. Elle progresse au dribble pied gauche. Au 1c1 final, elle a éliminé son adversaire deux fois de suite." }]
    });
    expect(r.code).toBe("seance-precedente");
    expect(r.message).toContain("9 novembre");
  });

  it("accepte deux notes différentes pour deux filles", () => {
    const r = checkNote({
      ...base,
      note: "Fatiguée en début de séance, elle s'est réveillée au jeu réduit et a marqué deux fois. Sa frappe pied droit progresse. Au 4c4, elle a demandé le ballon dans l'espace au bon moment.",
      sameActivity: [{ playerName: "Mia", note: "Timide aujourd'hui, a eu besoin d'encouragements pour oser le dribble face à l'adversaire. Elle protège mieux son ballon qu'avant. Au rondo, elle a gardé la balle sous pression trois fois." }]
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
    expect(payHold({ activityDate: "2026-11-05", status: "present", confirmed: true, report: { required: true, complete: false } })).toBe("rapport");
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

describe("règle du rapport complet du 19 nov. 2026", () => {
  const long = "Souriante et concentrée. Son contrôle orienté progresse, elle lève la tête plus tôt. Au 2c2, elle a cadré la porteuse et récupéré le ballon deux fois de suite.";
  const roster = [{ registrationId: "a", name: "Léa B." }];
  const attendance = [{ registration_id: "a", status: "present", practice_rating: 8, fatigue: 5 }];

  it("compte les mots", () => {
    expect(countWords("l'équipe a 2 buts")).toBe(5);
    expect(countWords(long)).toBeGreaterThanOrEqual(25);
  });

  it("demande 25 mots d'observation à partir du 19 nov., 30 caractères avant", () => {
    const ev = { ratings: fullRatings, comment: "Concentrée et souriante, belle progression au contrôle." };
    expect(isQuickEvaluationComplete(ev, "2026-11-18")).toBe(true);
    expect(isQuickEvaluationComplete(ev, "2026-11-19")).toBe(false);
    expect(isQuickEvaluationComplete({ ratings: fullRatings, comment: long }, "2026-11-19")).toBe(true);
  });

  it("veut 2 points qui ont bien marché et 2 à améliorer, de 4 mots ou plus", () => {
    expect(debriefPoints("1. Les transitions étaient rapides\n- ok\n2) Mia a bien guidé son équipe")).toHaveLength(2);
    expect(isDebriefComplete({ wentWell: "Les transitions étaient rapides\nMia a bien guidé son équipe", toImprove: "Trop d'attente en file" })).toBe(false);
    expect(isDebriefComplete({ wentWell: "Les transitions étaient rapides\nMia a bien guidé son équipe", toImprove: "Trop d'attente en file au rondo\nLe montage pas prêt à l'arrivée" })).toBe(true);
  });

  it("paie le terrain dès la présence ; l'heure de rapport des coachs seulement quand le rapport est fini", () => {
    const activity = { activity_type: "Pratique", activity_date: "2026-11-20" };
    const evaluations = [{ registration_id: "a", ratings: fullRatings, comment: long }];
    const noSurvey = computeReport({ activity, roster, attendance: [{ registration_id: "a", status: "present" }], evaluations });
    expect(noSurvey.complete).toBe(false);
    expect(reportMissing(noSurvey, "c1")).toContain("1 fille sans sondage du jour");
    // Le terrain est payé quand même.
    expect(payHold({ activityDate: "2026-11-20", status: "present", confirmed: true, report: noSurvey, coachId: "c1" })).toBeNull();
    expect(payHold({ activityDate: "2026-11-20", status: "present", confirmed: false, report: noSurvey, coachId: "c1" })).toBe("presence");
    expect(reportHour({ activityDate: "2026-11-20", status: "present", role: "Entraîneur principal", coachId: "c1", report: noSurvey })).toEqual({ due: true, earned: false });

    const debriefs = [{ coachId: "c1", wentWell: "Les transitions étaient rapides\nMia a bien guidé son équipe", toImprove: "Trop d'attente en file au rondo\nLe montage pas prêt à l'arrivée" }];
    const r = computeReport({ activity, roster, attendance, evaluations, debriefs });
    expect(r.complete).toBe(true);
    expect(reportHour({ activityDate: "2026-11-20", status: "present", role: "Entraîneur principal", coachId: "c1", report: r })).toEqual({ due: true, earned: true });
    expect(reportHour({ activityDate: "2026-11-20", status: "present", role: "Entraîneur principal", coachId: "c2", report: r })).toEqual({ due: true, earned: false });
    expect(reportMissing(r, "c2")).toEqual(["ton retour : 2 choses qui ont bien marché et 2 à améliorer"]);
    // L'assistant n'a pas d'heure de rapport.
    expect(reportHour({ activityDate: "2026-11-20", status: "present", role: "Assistant", coachId: "c1", report: r })).toEqual({ due: false, earned: false });
  });

  it("pas de rapport pour les programmes de garçons", () => {
    const roster = [{ registrationId: "a", name: "Léo" }];
    expect(computeReport({ activity: { activity_type: "Pratique", title: "Programme intensif garçons 2015" }, roster, attendance: [], evaluations: [] }).required).toBe(false);
    expect(computeReport({ activity: { activity_type: "Pratique", category: "Filles 2015" }, roster, attendance: [], evaluations: [] }).required).toBe(true);
  });

  it("une seule heure de rapport par coach et par jour, gagnée quand chaque pratique du jour a son rapport", () => {
    const m = dailyReportHours([
      { key: "a", coachId: "c1", date: "2026-11-25", start: "18:00", due: true, earned: true },
      { key: "b", coachId: "c1", date: "2026-11-25", start: "19:30", due: true, earned: false },
      { key: "c", coachId: "c2", date: "2026-11-25", start: "18:00", due: true, earned: true },
      { key: "d", coachId: "c1", date: "2026-11-26", start: "18:30", due: false, earned: false }
    ]);
    expect(m.get("a")).toEqual({ due: false, earned: false });
    expect(m.get("b")).toEqual({ due: true, earned: false });
    expect(m.get("c")).toEqual({ due: true, earned: true });
    expect(m.get("d")).toEqual({ due: false, earned: false });
  });

  it("du 8 au 18 nov. : heure de rapport donnée aux coachs et rien de retenu pour le rapport", () => {
    const report = { required: true, complete: false, strict: false, debriefDone: [] };
    expect(reportHour({ activityDate: "2026-11-11", status: "present", role: "Entraîneur principal", coachId: "c1", report })).toEqual({ due: true, earned: true });
    expect(reportHour({ activityDate: "2026-11-11", status: "present", role: "Assistant", coachId: "c1", report })).toEqual({ due: false, earned: false });
    expect(payHold({ activityDate: "2026-11-11", status: "present", confirmed: true, report })).toBeNull();
    expect(payHold({ activityDate: "2026-11-05", status: "present", confirmed: true, report })).toBe("rapport");
  });

  it("garde la règle d'avant pour les pratiques jusqu'au 18 nov.", () => {
    const r = computeReport({ activity: { activity_type: "Pratique", activity_date: "2026-11-18" }, roster, attendance: [{ registration_id: "a", status: "present" }], evaluations: [{ registration_id: "a", ratings: fullRatings, comment: "Concentrée et souriante, belle progression au contrôle." }] });
    expect(r.complete).toBe(true);
    expect(payHold({ activityDate: "2026-11-18", status: "present", confirmed: true, report: r, coachId: "c1" })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  buildPlayerStats,
  buildRoster,
  categoryLabel,
  clubInitials,
  contrastRatio,
  crestColors,
  evalOn10,
  matchDayLabel,
  matchEndMinute,
  matchesPlayerQuery,
  matchLengthMinutes,
  missingFor,
  nextStatus,
  normalizeAnalysis,
  opponentFromBooking,
  ourTeamLabel,
  outcomeOf,
  pairSlotsWithActivities,
  parseLogo,
  parseVideoLink,
  phaseOf,
  playedMinutes,
  recordHeadline,
  safeVideoFileName,
  seasonRecord,
  seasonStartYear,
  shortPlace,
  tidyClubName,
  tidyOpponent,
  timeLabel,
  type MatchParticipation,
  clauseTone,
  hasLessonIn,
  lessonLine,
  lessonMarker,
  lessonNotesFrom,
  mergeLessonIntoNotes,
  nextWeekStart,
  ourNameFor,
  guessCategoryId,
  slotActivityTitle,
  endOrDefault,
  parseFixture,
  splitClauses,
  summarizeLessons,
  themesIn
} from "@/lib/match-results-core";

const hexToRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

describe("noms et pastilles", () => {
  it("nettoie un nom de club venu d'un formulaire", () => {
    expect(tidyClubName("Fc laval")).toBe("FC Laval");
    expect(tidyClubName("CS Mont-Royal Outremont")).toBe("CS Mont-Royal Outremont");
    expect(tidyOpponent("Fc laval · U11 féminin D1")).toBe("FC Laval · U11 féminin D1");
    expect(opponentFromBooking("as blainville", "U12 D2")).toBe("AS Blainville · U12 D2");
    expect(opponentFromBooking(null, null)).toBeNull();
  });

  it("retire « New Valkyria — » de notre équipe et lit la catégorie", () => {
    expect(ourTeamLabel("New Valkyria — Équipe 2015 avancé (filles)")).toBe("Équipe 2015 avancé (filles)");
    expect(categoryLabel("2015")).toBe("Équipe 2015");
    expect(categoryLabel("2014-2015")).toBe("Équipe 2014-2015");
    expect(categoryLabel("Mélangé")).toBe("Groupe mélangé");
    expect(categoryLabel(null)).toBeNull();
    expect(shortPlace("Complexe sportif Terrebonne, Centre de soccer multifonctionnel, terrain #4")).toBe("Complexe sportif Terrebonne");
  });

  it("donne des initiales lisibles", () => {
    expect(clubInitials("FC Laval · U11 féminin D1")).toBe("FL");
    expect(clubInitials("Laval")).toBe("LA");
    expect(clubInitials("Club de soccer de la Rive-Nord")).toBe("CSR");
    expect(clubInitials("")).toBe("?");
  });

  it("tire toujours la même couleur d'un nom, lisible en blanc", () => {
    expect(crestColors("FC Laval")).toEqual(crestColors("fc laval · U11"));
    for (const n of ["FC Laval", "AS Blainville", "Lakers", "CS Longueuil", "Boisbriand", "Mirabel", "Terrebonne", "Repentigny", "Saint-Laurent", "Pierrefonds", "Gatineau", "Rimouski"]) {
      const { bg, fg } = crestColors(n);
      expect(contrastRatio(hexToRgb(bg), hexToRgb(fg))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accepte une image https ou un emoji comme logo", () => {
    expect(parseLogo("https://exemple.com/logo.png")).toEqual({ kind: "image", url: "https://exemple.com/logo.png" });
    expect(parseLogo("🦁")).toEqual({ kind: "emoji", text: "🦁" });
    expect(parseLogo("javascript:alert(1)")).toBeNull();
    expect(parseLogo("http://non-securise.com/a.png")).toBeNull();
    expect(parseLogo("un texte beaucoup trop long")).toBeNull();
    expect(parseLogo("")).toBeNull();
  });
});

describe("vidéo", () => {
  it("prépare le lecteur YouTube, Drive et Vimeo", () => {
    expect(parseVideoLink("https://youtu.be/dQw4w9WgXcQ")?.embed).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(parseVideoLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")?.embed).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(parseVideoLink("https://youtube.com/live/dQw4w9WgXcQ")?.kind).toBe("youtube");
    expect(parseVideoLink("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing")?.embed).toBe("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview");
    expect(parseVideoLink("https://vimeo.com/123456789")?.embed).toBe("https://player.vimeo.com/video/123456789");
  });

  it("garde Veo et les autres liens comme liens simples", () => {
    expect(parseVideoLink("https://app.veo.co/matches/20261115-match/")).toMatchObject({ kind: "veo", embed: null });
    expect(parseVideoLink("https://exemple.com/video")).toMatchObject({ kind: "autre", embed: null });
    expect(parseVideoLink("pas un lien")).toBeNull();
    expect(parseVideoLink("ftp://exemple.com/a.mp4")).toBeNull();
  });

  it("nettoie le nom du fichier déposé", () => {
    expect(safeVideoFileName("Match vs Laval (15 nov).MOV")).toBe("Match-vs-Laval-15-nov.mov");
    expect(safeVideoFileName("vidéo été.mp4")).toBe("video-ete.mp4");
    expect(safeVideoFileName("sans-extension")).toBe("sans-extension.mp4");
  });
});

describe("résultat et saison", () => {
  const base = { status: "scheduled" as const, scoreUs: null, scoreThem: null };

  it("calcule victoire, nul, défaite", () => {
    expect(outcomeOf(3, 1)).toBe("V");
    expect(outcomeOf(2, 2)).toBe("N");
    expect(outcomeOf(0, 1)).toBe("D");
    expect(outcomeOf(null, 1)).toBeNull();
  });

  it("place chaque match : à venir, aujourd'hui, joué, annulé", () => {
    expect(phaseOf({ ...base, date: "2026-11-15" }, "2026-11-02")).toBe("a_venir");
    expect(phaseOf({ ...base, date: "2026-11-02" }, "2026-11-02")).toBe("aujourdhui");
    expect(phaseOf({ ...base, date: "2026-11-01" }, "2026-11-02")).toBe("joue");
    expect(phaseOf({ ...base, date: "2026-11-02", scoreUs: 1, scoreThem: 0 }, "2026-11-02")).toBe("joue");
    expect(phaseOf({ ...base, date: "2026-11-01", status: "cancelled" }, "2026-11-02")).toBe("annule");
  });

  it("fait le bilan de la saison", () => {
    const today = "2026-12-01";
    const r = seasonRecord(
      [
        { ...base, date: "2026-11-01", scoreUs: 3, scoreThem: 1 },
        { ...base, date: "2026-11-08", scoreUs: 2, scoreThem: 2 },
        { ...base, date: "2026-11-15", scoreUs: 0, scoreThem: 1 },
        { ...base, date: "2026-11-22" },
        { ...base, date: "2026-11-29", status: "cancelled" },
        { ...base, date: "2026-12-06" }
      ],
      today
    );
    expect(r).toMatchObject({ played: 4, scored: 3, wins: 1, draws: 1, losses: 1, goalsFor: 5, goalsAgainst: 4, missingScore: 1, upcoming: 1, cancelled: 1 });
    expect(recordHeadline(r)).toBe("1 victoire, 1 nul, 1 défaite");
    expect(recordHeadline(seasonRecord([{ ...base, date: "2026-12-06" }], today))).toBe("Aucun match joué encore cette saison");
    expect(recordHeadline(seasonRecord([{ ...base, date: "2026-11-06" }, { ...base, date: "2026-11-07" }], today))).toBe("2 matchs joués : score à entrer");
    expect(recordHeadline(seasonRecord([], today))).toBe("Aucun match cette saison");
  });

  it("dit ce qui manque à un match joué", () => {
    const m = { ...base, date: "2026-11-01", summary: null, videoUrl: null, videoPath: null, activityVideoUrl: null };
    expect(missingFor(m, "2026-11-02")).toEqual(["score", "résumé", "vidéo"]);
    expect(missingFor({ ...m, scoreUs: 1, scoreThem: 0, summary: "Beau match", activityVideoUrl: "https://youtu.be/x" }, "2026-11-02")).toEqual([]);
    expect(missingFor({ ...m, date: "2026-11-09" }, "2026-11-02")).toEqual([]);
  });

  it("choisit le statut à enregistrer", () => {
    expect(nextStatus("scheduled", { cancelled: true, scoreUs: 1, scoreThem: 0 })).toBe("cancelled");
    expect(nextStatus("scheduled", { cancelled: false, scoreUs: 1, scoreThem: 0 })).toBe("completed");
    expect(nextStatus("live", { cancelled: false, scoreUs: null, scoreThem: null })).toBe("live");
    expect(nextStatus("cancelled", { cancelled: false, scoreUs: null, scoreThem: null })).toBe("scheduled");
  });

  it("coupe les saisons au 1er août", () => {
    expect(seasonStartYear("2026-11-15")).toBe(2026);
    expect(seasonStartYear("2027-07-31")).toBe(2026);
    expect(seasonStartYear("2027-08-01")).toBe(2027);
  });

  it("lit une analyse ancienne ou vide", () => {
    expect(normalizeAnalysis({ strengths: "Pressing", fixes: 3 })).toEqual({ strengths: "Pressing", fixes: "", actions: "" });
    expect(normalizeAnalysis("Texte libre")).toEqual({ strengths: "Texte libre", fixes: "", actions: "" });
    expect(normalizeAnalysis(null)).toEqual({ strengths: "", fixes: "", actions: "" });
  });
});

describe("relier une plage vendue à l'activité du même match", () => {
  const slots = [
    { id: "s1", date: "2026-11-15", start: "17:30" },
    { id: "s2", date: "2026-11-22", start: "16:30" },
    { id: "s3", date: "2026-11-22", start: "17:30" }
  ];

  it("utilise d'abord le lien enregistré, puis la même date et la même heure", () => {
    const pairs = pairSlotsWithActivities(
      [
        { id: "a1", date: "2026-11-15", start: "17:30:00", linkedSlotId: null },
        { id: "a2", date: "2026-11-22", start: "10:00", linkedSlotId: "s3" },
        { id: "a3", date: "2026-11-22", start: "16:30", linkedSlotId: null }
      ],
      slots
    );
    expect(Object.fromEntries(pairs)).toEqual({ a1: "s1", a2: "s3", a3: "s2" });
  });

  it("ne devine pas quand deux activités partagent la même heure", () => {
    const pairs = pairSlotsWithActivities(
      [
        { id: "a1", date: "2026-11-15", start: "17:30", linkedSlotId: null },
        { id: "a2", date: "2026-11-15", start: "17:30", linkedSlotId: null }
      ],
      slots
    );
    expect(pairs.size).toBe(0);
  });
});

describe("temps de jeu et joueuses", () => {
  it("compte les minutes, une entrée sans sortie va jusqu'à la fin", () => {
    expect(matchLengthMinutes("17:30", "18:30")).toBe(60);
    expect(matchLengthMinutes("18:30", "17:30")).toBeNull();
    expect(playedMinutes([{ registration_id: "r", minute_in: 0, minute_out: 25 }, { registration_id: "r", minute_in: 40, minute_out: null }], 60)).toBe(45);
    expect(matchEndMinute(null, [{ registration_id: "r", minute_in: 0, minute_out: 70 }])).toBe(70);
    expect(evalOn10({ scale: 100, score: 75 })).toBe(7.5);
    expect(evalOn10({ scale: 10, score: null })).toBeNull();
  });

  const p: MatchParticipation = {
    lineup: [
      { registration_id: "charlotte", is_starter: true, position_code: "MC" },
      { registration_id: "lea", is_starter: false, position_code: null },
      { registration_id: "zoe", is_starter: false, position_code: null }
    ],
    segments: [
      { registration_id: "charlotte", minute_in: 0, minute_out: 50 },
      { registration_id: "lea", minute_in: 50, minute_out: null }
    ],
    evaluations: [
      { registration_id: "charlotte", scale: 10, score: 8, comment: "Très bonne relance" },
      { registration_id: "charlotte", scale: 100, score: 70, comment: null }
    ]
  };

  it("liste les présentes : titulaire, remplaçante entrée, remplaçante restée sur le banc", () => {
    const roster = buildRoster(p, 60, { charlotte: "Charlotte Tremblay", lea: "Léa Roy", zoe: "Zoé Gagnon" });
    expect(roster.map((r) => [r.name, r.played, r.minutes, r.starter, r.evalAvg])).toEqual([
      ["Charlotte Tremblay", true, 50, true, 7.5],
      ["Léa Roy", true, 10, false, null],
      ["Zoé Gagnon", false, 0, false, null]
    ]);
    expect(roster[0].comments).toEqual(["Très bonne relance"]);
  });

  it("sans temps de jeu noté, l'alignement suffit pour compter le match", () => {
    const roster = buildRoster({ lineup: p.lineup, segments: [], evaluations: [] }, 60);
    expect(roster.every((r) => r.played && r.minutes === null)).toBe(true);
  });

  it("répond à « combien de matchs Charlotte a joués »", () => {
    const stats = buildPlayerStats(
      [
        { id: "m1", date: "2026-11-01", opponent: "FC Laval", scoreUs: 3, scoreThem: 1, endMinute: 60, cancelled: false },
        { id: "m2", date: "2026-11-08", opponent: "AS Blainville", scoreUs: 0, scoreThem: 2, endMinute: 60, cancelled: false },
        { id: "m3", date: "2026-11-15", opponent: "Lakers", scoreUs: null, scoreThem: null, endMinute: 60, cancelled: true }
      ],
      {
        m1: p,
        m2: { lineup: [{ registration_id: "charlotte-2", is_starter: false, position_code: null }], segments: [{ registration_id: "charlotte-2", minute_in: 30, minute_out: 60 }], evaluations: [] },
        m3: p
      },
      {
        charlotte: { key: "player-charlotte", name: "Charlotte Tremblay", birthYear: 2015 },
        "charlotte-2": { key: "player-charlotte", name: "Charlotte Tremblay", birthYear: 2015 },
        lea: { key: "player-lea", name: "Léa Roy", birthYear: 2015 },
        zoe: { key: "player-zoe", name: "Zoé Gagnon", birthYear: 2015 }
      }
    );
    const charlotte = stats.find((s) => s.name === "Charlotte Tremblay")!;
    expect(charlotte).toMatchObject({ matches: 2, starts: 1, minutes: 80, timedMatches: 2, avgMinutes: 40, evalAvg: 7.5, evalCount: 1, wins: 1, losses: 1, lastDate: "2026-11-08" });
    expect(charlotte.games.map((g) => g.matchId)).toEqual(["m2", "m1"]);
    expect(stats[0].name).toBe("Charlotte Tremblay");
    expect(stats.find((s) => s.name === "Zoé Gagnon")).toBeUndefined();
    expect(stats.find((s) => s.name === "Léa Roy")).toMatchObject({ matches: 1, minutes: 10 });
  });

  it("trouve une joueuse sans accents ni majuscules", () => {
    expect(matchesPlayerQuery("Charlotte Tremblay", "charlotte")).toBe(true);
    expect(matchesPlayerQuery("Zoé Gagnon", "zoe gag")).toBe(true);
    expect(matchesPlayerQuery("Léa Roy", "charlotte")).toBe(false);
    expect(matchesPlayerQuery("Léa Roy", "")).toBe(true);
  });
});

describe("libellés", () => {
  it("écrit l'heure et la date à la québécoise", () => {
    expect(timeLabel("17:30:00")).toBe("17 h 30");
    expect(timeLabel(null)).toBe("");
    expect(matchDayLabel("2026-11-15")).toBe("dim. 15 nov.");
    expect(matchDayLabel("2026-11-01", true)).toBe("dim. 1er nov. 2026");
  });
});

describe("matchs hors Académie (titre de l'activité)", () => {
  it("lit l'organisation et l'affiche du match", () => {
    expect(ourNameFor("Saint-Gabriel (futsal cadet D4)")).toBe("Saint-Gabriel");
    expect(ourNameFor(null)).toBe("New Valkyria");
    expect(parseFixture("Match Cadet D4 St-Gabriel : Curé-Mercure c. Saint-Gabriel", "Saint-Gabriel")).toEqual({ opponent: "Curé-Mercure", homeAway: "away" });
    expect(parseFixture("Match Cadet D4 St-Gabriel : Saint-Gabriel c. Lucille-Teasdale", "Saint-Gabriel")).toEqual({ opponent: "Lucille-Teasdale", homeAway: "home" });
    expect(parseFixture("Match : Académie Ste-Thérèse c. Saint-Gabriel", "Saint-Gabriel")).toEqual({ opponent: "Académie Ste-Thérèse", homeAway: "away" });
    expect(parseFixture("New Valkyria vs FC Laval", "New Valkyria")).toEqual({ opponent: "FC Laval", homeAway: "home" });
    expect(parseFixture("Coaching futsal des cadets – St-Gabriel", "Saint-Gabriel")).toBeNull();
    expect(parseFixture(null, "New Valkyria")).toBeNull();
  });
});

describe("résumé d'après-match → à travailler en pratique", () => {
  it("reconnaît les thèmes de soccer en français", () => {
    const t = (s: string) => themesIn(s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    expect(t("Bonnes passes")).toEqual(["passes"]);
    expect(t("ce qui s'est passé au début")).toEqual([]);
    expect(t("Premier contrôle trop long")).toEqual(["controle"]);
    expect(t("Perd ses 1 contre 1")).toContain("un-contre-un");
    expect(t("Doit lever la tête avant de recevoir")).toEqual(["vision"]);
    expect(t("Ne parle pas à ses coéquipières")).toEqual(["communication"]);
    expect(t("Belle frappe, deux buts")).toEqual(["finition"]);
    expect(t("Repli défensif lent")).toEqual(expect.arrayContaining(["defense", "physique"]));
    expect(t("Excellente gardienne, beaux arrêts")).toEqual(["gardienne"]);
    expect(t("Manque de confiance")).toEqual(["attitude"]);
  });

  it("sépare forces et points à corriger, avec le ton reporté après une virgule et inversé après « mais »", () => {
    expect(clauseTone("bonnes passes")).toBe(1);
    expect(clauseTone("pas assez de tirs")).toBe(-1);
    expect(clauseTone("pas mal du tout")).toBe(1);
    expect(clauseTone("le placement")).toBe(0);
    expect(clauseTone("placement a revoir")).toBe(-1);
    expect(clauseTone("a retravailler")).toBe(-1);
    const s = splitClauses("Bonnes passes, contrôle propre mais le placement. Doit communiquer");
    expect(s).toHaveLength(2);
    expect(s[0].map((c) => c.text)).toEqual(["Bonnes passes", "contrôle propre", "le placement"]);
    expect(s[0][2].afterContrast).toBe(true);
    const r = summarizeLessons([{ matchId: "m1", notes: [{ player: "Charlotte Roy", note: 7, text: "Bonnes passes, contrôle propre mais le placement. Doit communiquer", source: "joueuse" }] }]);
    const by = Object.fromEntries(r.themes.map((x) => [x.key, x]));
    expect(by.passes.positive).toBe(1);
    expect(by.controle.positive).toBe(1);
    expect(by.placement.negative).toBe(1);
    expect(by.communication.negative).toBe(1);
    expect(r.strengths.map((x) => x.key)).toEqual(expect.arrayContaining(["passes", "controle"]));
    expect(r.toFix.map((x) => x.key)).toEqual(expect.arrayContaining(["placement", "communication"]));
    expect(by.placement.playersToFix).toEqual(["Charlotte Roy"]);
  });

  it("une note basse rend négatif un commentaire sans mot clair, et la joueuse est à surveiller", () => {
    const r = summarizeLessons([
      {
        matchId: "m1",
        notes: [
          { player: "Léa Tremblay", note: 4, text: "Conduite et placement", source: "joueuse" },
          { player: "Zoé Gagnon", note: 9, text: "Conduite", source: "joueuse" },
          { player: "Mia Côté", note: 6, text: "", source: "joueuse" }
        ]
      }
    ]);
    expect(r.evaluated).toBe(3);
    expect(r.avgNote).toBeCloseTo(6.3, 1);
    const by = Object.fromEntries(r.themes.map((x) => [x.key, x]));
    expect(by.conduite).toMatchObject({ mentions: 2, positive: 1, negative: 1 });
    expect(r.watch.map((w) => w.name)).toEqual(["Léa Tremblay"]);
    expect(r.watch[0]).toMatchObject({ note: 4, themes: ["Conduite", "Placement"] });
  });

  it("agrège plusieurs matchs, compte les mentions et propose 3 priorités", () => {
    const analysis = { strengths: "Pressing haut efficace", fixes: "Transition défensive après la perte du ballon", actions: "Travailler la communication et les passes courtes" };
    const r = summarizeLessons([
      { matchId: "m1", notes: lessonNotesFrom([{ player: "Charlotte Roy", scale: 10, score: 5, comment: "Perd le ballon en transition, doit regarder avant" }, { player: "Léa Tremblay", scale: 100, score: 85, comment: "Très bonne vision du jeu" }], analysis, "Belle victoire") },
      { matchId: "m2", notes: lessonNotesFrom([{ player: "Charlotte Roy", scale: 10, score: 6, comment: "Transition lente, passes imprécises" }], null) }
    ]);
    expect(r.matches).toBe(2);
    const by = Object.fromEntries(r.themes.map((x) => [x.key, x]));
    expect(by.transition.negative).toBe(3);
    expect(by.transition.matches).toBe(2);
    expect(by.pressing.positive).toBe(1);
    expect(r.priorities).toHaveLength(3);
    expect(r.priorities[0]).toMatchObject({ key: "transition", kind: "corriger" });
    expect(r.priorities[0].why).toContain("3 mentions à corriger");
    expect(r.priorities[0].why).toContain("dans 2 matchs");
    expect(r.priorities[0].why).toContain("Charlotte");
    expect(r.priorities.map((p) => p.key)).toContain("passes");
    expect(r.strengths.map((s) => s.key)).toEqual(expect.arrayContaining(["pressing"]));
    expect(r.watch.map((w) => w.name)).toEqual(["Charlotte Roy"]);
    expect(r.watch[0].note).toBe(5.5);
  });

  it("garde les points à corriger sans thème et complète les priorités à consolider", () => {
    const r = summarizeLessons([{ matchId: "m1", notes: [{ player: null, note: null, text: "Arrivées en retard à l'échauffement", source: "corriger" }, { player: null, note: null, text: "Super pressing", source: "forces" }] }]);
    expect(r.otherFixes).toEqual(["Arrivées en retard à l'échauffement"]);
    expect(r.priorities).toEqual([{ key: "pressing", label: "Pressing", kind: "consolider", why: "1 mention, dont 1 positive : à consolider" }]);
    expect(summarizeLessons([]).empty).toBe(true);
    expect(summarizeLessons([{ matchId: "x", notes: [{ player: "A", note: null, text: "  ", source: "joueuse" }] }]).empty).toBe(true);
  });

  it("écrit la ligne du thème de la semaine prochaine sans doublon", () => {
    expect(nextWeekStart("2026-11-07", "2026-11-06")).toBe("2026-11-09");
    expect(nextWeekStart("2026-11-07", "2026-11-07")).toBe("2026-11-09");
    expect(nextWeekStart("2026-11-09", "2026-11-09")).toBe("2026-11-16");
    expect(nextWeekStart("2026-10-01", "2026-11-11")).toBe("2026-11-16");
    // Noté le lundi qui suit le match : c'est encore la semaine d'après le match ; le mardi, la suivante.
    expect(nextWeekStart("2026-11-07", "2026-11-09")).toBe("2026-11-09");
    expect(nextWeekStart("2026-11-07", "2026-11-10")).toBe("2026-11-16");
    const m = { date: "2026-11-07", opponent: "Curé-Mercure", category: "Cadet D4" };
    const line = lessonLine(m, [{ label: "Transition", kind: "corriger" }, { label: "Passes", kind: "corriger" }, { label: "Pressing", kind: "consolider" }]);
    expect(line).toBe("Après le match du sam. 7 nov. contre Curé-Mercure (Cadet D4) — à travailler : 1. Transition ; 2. Passes ; 3. Pressing (à consolider).");
    const marker = lessonMarker(m);
    const once = mergeLessonIntoNotes("PSG Academy, semaine 14.\n", line, marker);
    expect(once).toBe(`PSG Academy, semaine 14.\n${line}`);
    const twice = mergeLessonIntoNotes(once, line.replace("Passes", "Contrôle"), marker);
    expect(twice.split("\n")).toHaveLength(2);
    expect(twice).toContain("2. Contrôle");
    expect(mergeLessonIntoNotes(null, line, marker)).toBe(line);
    expect(hasLessonIn(twice, marker)).toBe(true);
    expect(hasLessonIn("PSG", marker)).toBe(false);
  });
  it("lit une négation qui dit une force, les buts encaissés et les pertes de ballon", () => {
    const n = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’]/g, "'");
    expect(clauseTone(n("Elle n'a pas eu peur des duels"))).toBe(1);
    expect(clauseTone(n("Sans peur dans les duels"))).toBe(1);
    expect(clauseTone(n("N'hésite pas à tirer"))).toBe(1);
    expect(clauseTone(n("Ne lâche rien"))).toBe(1);
    expect(clauseTone(n("A peur des duels"))).toBe(-1);
    expect(clauseTone(n("Très combative"))).toBe(1);
    expect(clauseTone(n("Manque de combativité"))).toBe(-1);
    expect(themesIn(n("Deux buts encaissés sur contre-attaque"))).toEqual(expect.arrayContaining(["defense", "transition"]));
    expect(themesIn(n("Deux buts encaissés sur contre-attaque"))).not.toContain("finition");
    expect(themesIn(n("On perd le ballon trop vite"))).toContain("transition");
    const r = summarizeLessons([{ matchId: "m1", notes: [{ player: "Rose Lavoie", note: 8, text: "Elle n'a pas eu peur des duels, très combative", source: "joueuse" }] }]);
    expect(r.watch).toEqual([]);
    expect(r.strengths.map((t) => t.key)).toEqual(expect.arrayContaining(["un-contre-un", "attitude"]));
    expect(r.toFix).toEqual([]);
  });
});

describe("créer l'activité d'un match vendu", () => {
  const cats = [
    { id: "2013-2012", label: "2013–2012" },
    { id: "2015", label: "2015" },
    { id: "2016", label: "2016" },
    { id: "2017", label: "2017-2018" }
  ];
  it("devine la catégorie de l'équipe", () => {
    expect(guessCategoryId("New Valkyria — Équipe 2015 avancé (filles)", cats)).toBe("2015");
    expect(guessCategoryId("New Valkyria — Équipe 2016-2017 avancé (filles)", cats)).toBe("2016");
    expect(guessCategoryId("Équipe 2018", cats)).toBe("2017");
    expect(guessCategoryId("Équipe 2012", cats)).toBe("2013-2012");
    expect(guessCategoryId("Équipe mixte", cats)).toBeNull();
    expect(guessCategoryId(null, cats)).toBeNull();
  });
  it("écrit le titre et l'heure de fin", () => {
    expect(slotActivityTitle("New Valkyria — Équipe 2015 avancé (filles)", "FC Laval · U11 féminin D1")).toBe("Match Équipe 2015 avancé (filles) : New Valkyria c. FC Laval");
    expect(slotActivityTitle(null, null)).toBe("Match : New Valkyria c. adversaire");
    expect(endOrDefault("08:15", "09:45")).toBe("09:45");
    expect(endOrDefault("08:15", null)).toBe("09:45");
    expect(endOrDefault("23:00", null)).toBe("23:59");
  });
});

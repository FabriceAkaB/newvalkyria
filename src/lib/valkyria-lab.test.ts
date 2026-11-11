// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CHALLENGE_GESTURE,
  addMonths,
  asciiSlug,
  checkVideoFile,
  commentEmail,
  familiesFromRegistrations,
  familyRate,
  firstNames,
  gameOfWeek,
  gestureOptions,
  linkEmail,
  monthlyHistory,
  nextVideoFileName,
  normalizeRoutine,
  ofMonth,
  parseVideoPath,
  pickRoutine,
  playerFolder,
  playerSlug,
  publishProblems,
  videoBaseName,
  videoEmbed,
  weekIndex,
  type LabRoutine,
  type RegistrationLite
} from "@/lib/valkyria-lab";

const MB = 1024 * 1024;

describe("liens vidéo de démonstration", () => {
  it("YouTube : watch, youtu.be, shorts (vertical), embed", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")?.embedUrl).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://youtu.be/dQw4w9WgXcQ?si=abc")?.id).toBe("dQw4w9WgXcQ");
    const s = videoEmbed("https://youtube.com/shorts/dQw4w9WgXcQ");
    expect(s?.vertical).toBe(true);
    expect(videoEmbed("https://m.youtube.com/embed/dQw4w9WgXcQ")?.provider).toBe("youtube");
  });

  it("Vimeo non répertorié garde son code privé", () => {
    expect(videoEmbed("https://vimeo.com/123456789/abc123def4")?.embedUrl).toContain("player.vimeo.com/video/123456789?h=abc123def4");
    expect(videoEmbed("https://player.vimeo.com/video/123456789?h=ff00aa11")?.embedUrl).toContain("h=ff00aa11");
    expect(videoEmbed("https://vimeo.com/123456789")?.embedUrl).not.toContain("h=");
  });

  it("refuse les autres liens", () => {
    expect(videoEmbed("https://www.tiktok.com/@nv/video/1")).toBeNull();
    expect(videoEmbed("https://youtube.com/watch?v=court")).toBeNull();
    expect(videoEmbed("pas un lien")).toBeNull();
    expect(videoEmbed("javascript:alert(1)")).toBeNull();
    expect(videoEmbed(null)).toBeNull();
  });
});

describe("routine du mois", () => {
  const base = { month: "2026-11", title: " Routine de novembre ", exercises: [], weeklyGames: [] };

  it("retire les lignes vides et garde l'ordre", () => {
    const r = normalizeRoutine({
      ...base,
      exercises: [
        { name: "Semelle", how: "3 x 30 s", videoUrl: "https://youtu.be/dQw4w9WgXcQ" },
        { name: "", how: "", videoUrl: "" },
        { name: "Croquette", how: null, videoUrl: null }
      ],
      weeklyGames: [{ title: "Le miroir", how: "À deux" }, { title: "  " }]
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.title).toBe("Routine de novembre");
    expect(r.value.exercises.map((e) => e.name)).toEqual(["Semelle", "Croquette"]);
    expect(r.value.weekly_games).toHaveLength(1);
  });

  it("refuse un lien qui n'est pas YouTube ou Vimeo, un geste sans nom, deux gestes pareils", () => {
    expect(normalizeRoutine({ ...base, exercises: [{ name: "Semelle", videoUrl: "https://drive.google.com/x" }] }).ok).toBe(false);
    expect(normalizeRoutine({ ...base, exercises: [{ name: "", how: "3 x 30 s" }] }).ok).toBe(false);
    expect(normalizeRoutine({ ...base, exercises: [{ name: "Semelle" }, { name: "semelle" }] }).ok).toBe(false);
    expect(normalizeRoutine({ ...base, exercises: [{ name: CHALLENGE_GESTURE }] }).ok).toBe(false);
    expect(normalizeRoutine({ ...base, challengeVideoUrl: "https://example.com/v.mp4", challenge: "100 jongles" }).ok).toBe(false);
    expect(normalizeRoutine({ ...base, month: "2026-13" }).ok).toBe(false);
    expect(normalizeRoutine({ ...base, title: " " }).ok).toBe(false);
  });

  it("ne publie pas une routine vide", () => {
    expect(publishProblems({ exercises: [], challenge: null })).toHaveLength(1);
    expect(publishProblems({ exercises: [], challenge: "100 jongles" })).toHaveLength(0);
  });

  it("gestes à choisir : ceux de la routine puis le défi", () => {
    expect(gestureOptions({ exercises: [{ name: "Semelle", how: null, videoUrl: null }], challenge: "100 jongles" })).toEqual(["Semelle", CHALLENGE_GESTURE]);
    expect(gestureOptions({ exercises: [], challenge: null })).toEqual([]);
    expect(gestureOptions(null)).toEqual([]);
  });

  it("routine montrée : celle du mois si publiée, sinon la plus récente publiée avant", () => {
    const r = (month: string, status: LabRoutine["status"]) => ({ month, status });
    expect(pickRoutine([r("2026-11", "publie"), r("2026-10", "publie")], "2026-11")).toEqual({ routine: r("2026-11", "publie"), current: true });
    expect(pickRoutine([r("2026-11", "brouillon"), r("2026-10", "publie")], "2026-11")).toEqual({ routine: r("2026-10", "publie"), current: false });
    expect(pickRoutine([r("2026-12", "publie")], "2026-11")).toBeNull();
    expect(pickRoutine([], "2026-11")).toBeNull();
  });

  it("jeu de la semaine selon le jour du mois", () => {
    const games = [1, 2, 3, 4].map((n) => ({ title: `Jeu ${n}`, how: null, videoUrl: null }));
    expect(weekIndex("2026-11-01")).toBe(0);
    expect(weekIndex("2026-11-08")).toBe(1);
    expect(weekIndex("2026-11-30")).toBe(4);
    expect(gameOfWeek(games, "2026-11-10")?.game.title).toBe("Jeu 2");
    expect(gameOfWeek(games, "2026-11-30")).toEqual({ game: games[3], week: 4 });
    expect(gameOfWeek(games.slice(0, 1), "2026-11-20")?.week).toBe(1);
    expect(gameOfWeek([], "2026-11-20")).toBeNull();
  });

  it("mois", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -2)).toBe("2026-11");
    expect(ofMonth("2026-11")).toBe("de novembre");
    expect(ofMonth("2027-04")).toBe("d'avril");
    expect(ofMonth("2027-08")).toBe("d'août");
    expect(ofMonth("2026-10")).toBe("d'octobre");
  });
});

describe("noms de fichiers Prénom-Nom_geste_AAAA-MM-JJ_maison", () => {
  it("sans accents ni espaces", () => {
    expect(asciiSlug("Marie-Ève Côté")).toBe("Marie-Eve-Cote");
    expect(asciiSlug("Chloé O'Brien")).toBe("Chloe-O-Brien");
    expect(asciiSlug("Cœur")).toBe("Coeur");
    expect(playerSlug("  ")).toBe("Joueuse");
    expect(videoBaseName("Léa Tremblay", "Semelle intérieure", "2026-11-02")).toBe("Lea-Tremblay_semelle-interieure_2026-11-02_maison");
    expect(videoBaseName("Léa Tremblay", CHALLENGE_GESTURE, "2026-11-02")).toBe("Lea-Tremblay_defi-du-mois_2026-11-02_maison");
  });

  it("ajoute -2, -3 si la joueuse envoie le même geste le même jour", () => {
    expect(nextVideoFileName([], "Léa Tremblay", "Semelle", "2026-11-02", "mov")).toBe("Lea-Tremblay_semelle_2026-11-02_maison.mov");
    expect(nextVideoFileName(["Lea-Tremblay_semelle_2026-11-02_maison.mov"], "Léa Tremblay", "Semelle", "2026-11-02", "mp4")).toBe("Lea-Tremblay_semelle_2026-11-02_maison-2.mp4");
    expect(
      nextVideoFileName(["Lea-Tremblay_semelle_2026-11-02_maison.mov", "Lea-Tremblay_semelle_2026-11-02_maison-2.mp4"], "Léa Tremblay", "Semelle", "2026-11-02", "mp4")
    ).toBe("Lea-Tremblay_semelle_2026-11-02_maison-3.mp4");
  });

  it("vérifie le chemin envoyé par le navigateur", () => {
    const id = "6b0f8c1e-1111-4222-8333-444455556666";
    const folder = playerFolder(id, "Léa Tremblay");
    expect(folder).toBe(`${id}/Lea-Tremblay`);
    expect(parseVideoPath(`${folder}/Lea-Tremblay_semelle_2026-11-02_maison-2.mp4`, id, "Léa Tremblay", "Semelle")).toEqual({ date: "2026-11-02", fileName: "Lea-Tremblay_semelle_2026-11-02_maison-2.mp4" });
    expect(parseVideoPath(`${folder}/Lea-Tremblay_croquette_2026-11-02_maison.mp4`, id, "Léa Tremblay", "Semelle")).toBeNull();
    expect(parseVideoPath(`autre-famille/Lea-Tremblay/Lea-Tremblay_semelle_2026-11-02_maison.mp4`, id, "Léa Tremblay", "Semelle")).toBeNull();
    expect(parseVideoPath(`${folder}/../x/Lea-Tremblay_semelle_2026-11-02_maison.mp4`, id, "Léa Tremblay", "Semelle")).toBeNull();
    expect(parseVideoPath(`${folder}/Lea-Tremblay_semelle_2026-11-02_maison.exe`, id, "Léa Tremblay", "Semelle")).toBeNull();
  });
});

describe("fichier vidéo choisi par la famille", () => {
  it("accepte MP4 et MOV d'iPhone, devine le type si le téléphone ne le donne pas", () => {
    expect(checkVideoFile({ name: "IMG_0001.MOV", type: "video/quicktime", size: 20 * MB }, 50 * MB)).toEqual({ ok: true, ext: "mov", contentType: "video/quicktime" });
    expect(checkVideoFile({ name: "video.mp4", type: "", size: 5 * MB }, 50 * MB)).toEqual({ ok: true, ext: "mp4", contentType: "video/mp4" });
    expect(checkVideoFile({ name: "clip", type: "video/mp4", size: 5 * MB }, 50 * MB)).toMatchObject({ ok: true, ext: "mp4" });
  });

  it("refuse les photos, les fichiers vides et trop lourds", () => {
    expect(checkVideoFile({ name: "photo.jpg", type: "image/jpeg", size: MB }, 50 * MB).ok).toBe(false);
    expect(checkVideoFile({ name: "photo.mp4", type: "image/png", size: MB }, 50 * MB).ok).toBe(false);
    expect(checkVideoFile({ name: "doc.pdf", type: "", size: MB }, 50 * MB).ok).toBe(false);
    expect(checkVideoFile({ name: "v.mp4", type: "video/mp4", size: 0 }, 50 * MB).ok).toBe(false);
    const big = checkVideoFile({ name: "v.mp4", type: "video/mp4", size: 80 * MB }, 50 * MB);
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error).toContain("50 Mo");
  });
});

describe("familles actives", () => {
  const reg = (o: Partial<RegistrationLite>): RegistrationLite => ({ parent_email: "a@x.ca", parent_name: "marie TREMBLAY", player_first_name: "léa", player_last_name: "TREMBLAY", status: "paid", ...o });

  it("regroupe par courriel, garde les sœurs, ignore essais, non payées et demi-saisons terminées", () => {
    const fams = familiesFromRegistrations(
      [
        reg({}),
        reg({ parent_email: " A@X.ca ", player_first_name: "Emma" }),
        reg({ player_first_name: "Léa" }),
        reg({ parent_email: "b@x.ca", parent_name: "Paul Roy", player_first_name: "Zoé", player_last_name: "Roy", is_trial: true }),
        reg({ parent_email: "c@x.ca", status: "pending" }),
        reg({ parent_email: "d@x.ca", is_half_season: true, half_season_ends_on: "2026-10-31" }),
        reg({ parent_email: "e@x.ca", parent_name: "Julie Côté", player_first_name: "Rose", player_last_name: "Côté", is_half_season: true, half_season_ends_on: "2027-01-31" })
      ],
      "2026-11-02"
    );
    expect(fams.map((f) => f.email)).toEqual(["e@x.ca", "a@x.ca"]);
    const a = fams.find((f) => f.email === "a@x.ca")!;
    expect(a.parentName).toBe("Marie Tremblay");
    expect(a.players).toEqual([
      { firstName: "Léa", lastName: "Tremblay" },
      { firstName: "Emma", lastName: "Tremblay" }
    ]);
    expect(firstNames(a.players)).toBe("Léa et Emma");
    expect(firstNames([...a.players, { firstName: "Zoé", lastName: "" }])).toBe("Léa, Emma et Zoé");
  });
});

describe("mesure familles_video_lab", () => {
  const active = ["a@x.ca", "b@x.ca", "c@x.ca", "d@x.ca"];
  const sends = [
    { email: "a@x.ca", created_at: "2026-11-01T05:00:00Z" },
    { email: "A@x.ca", created_at: "2026-11-03T15:00:00Z" },
    { email: "b@x.ca", created_at: "2026-11-01T03:00:00Z" }, // 31 oct. à 23 h à Montréal
    { email: "zz@x.ca", created_at: "2026-11-05T15:00:00Z" }, // famille plus inscrite
    { email: null, created_at: "2026-11-05T15:00:00Z" }
  ];

  it("une famille compte une fois, à l'heure de Montréal, seulement si elle est active", () => {
    expect(familyRate(active, sends, "2026-11")).toEqual({ active: 4, sent: 1, rate: 0.25 });
    expect(familyRate(active, sends, "2026-10")).toEqual({ active: 4, sent: 1, rate: 0.25 });
    expect(familyRate([], sends, "2026-11").rate).toBeNull();
  });

  it("historique mois par mois", () => {
    const h = monthlyHistory(active, sends, "2026-11", 3);
    expect(h.map((x) => x.month)).toEqual(["2026-11", "2026-10", "2026-09"]);
    expect(h[0]).toMatchObject({ families: 1, videos: 4 });
    expect(h[1]).toMatchObject({ families: 1, videos: 1 });
    expect(h[2].families).toBe(0);
  });
});

describe("courriels", () => {
  it("lien personnel : prénoms, défi, lien newvalkyria.com, texte échappé", () => {
    const { subject, html } = linkEmail(
      { token: "tok_1234567890", parent_name: "Marie Tremblay", players: [{ firstName: "Léa", lastName: "Tremblay" }] },
      { month: "2026-11", title: "Routine <novembre>", challenge: "100 jongles" }
    );
    expect(subject).toBe("Valkyria Lab : la routine maison de novembre");
    expect(html).toContain("Bonjour Marie");
    expect(html).toContain("/lab/tok_1234567890");
    expect(html).toContain("Routine &lt;novembre&gt;");
    expect(html).toContain("100 jongles");
    expect(html).not.toContain("localhost");
  });

  it("commentaire du coach", () => {
    const { subject, html } = commentEmail({ token: "tok_1234567890", parent_name: "Marie" }, { player_name: "Léa Tremblay", gesture: "Semelle", coach_comment: "Bravo, tête haute !" });
    expect(subject).toBe("Valkyria Lab : le coach a vu la vidéo de Léa");
    expect(html).toContain("Bravo, tête haute !");
  });
});

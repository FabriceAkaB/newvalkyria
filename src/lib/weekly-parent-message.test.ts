import { describe, expect, it } from "vitest";

import {
  buildWeeklyMessage,
  groupFamilies,
  isDue,
  parseSettings,
  pickChampionPhoto,
  serializeSettings,
  targetWeek,
  type ChampionPhoto,
  type Family,
  type RegRow
} from "@/lib/weekly-parent-message";

const reg = (id: string, email: string, first: string, last: string, extra: Partial<RegRow> = {}): RegRow => ({
  id,
  parent_email: email,
  parent_name: "marie tremblay",
  player_first_name: first,
  player_last_name: last,
  category_id: "2015",
  season_id: "automne-hiver-2026",
  status: "paid",
  ...extra
});

describe("message de la semaine : réglage", () => {
  it("éteint par défaut, valeurs invalides remplacées", () => {
    expect(parseSettings(null)).toEqual({ actif: false, jour: "dimanche", heure: 18, dernierEnvoi: null });
    expect(parseSettings('{"actif":true,"jour":"lundi","heure":7}')).toMatchObject({ actif: true, jour: "lundi", heure: 7 });
    expect(parseSettings('{"actif":"oui","jour":"funday","heure":40}')).toMatchObject({ actif: false, jour: "dimanche", heure: 18 });
    expect(parseSettings("pas du json").actif).toBe(false);
    expect(parseSettings(serializeSettings({ actif: true, jour: "dimanche", heure: 18, dernierEnvoi: "2026-11-23" })).dernierEnvoi).toBe("2026-11-23");
  });

  it("le dimanche parle de la semaine qui commence ; en semaine, de la semaine en cours", () => {
    expect(targetWeek("2026-11-22")).toBe("2026-11-23"); // dimanche
    expect(targetWeek("2026-11-21")).toBe("2026-11-23"); // samedi
    expect(targetWeek("2026-11-19")).toBe("2026-11-16"); // jeudi
    expect(targetWeek("2026-11-23")).toBe("2026-11-23"); // lundi
  });

  it("part le bon jour, à l'heure, une seule fois par semaine, seulement si actif", () => {
    const on = { actif: true, jour: "dimanche" as const, heure: 18, dernierEnvoi: null };
    const sunday18 = new Date("2026-11-22T23:05:00Z"); // 18 h 05 à Montréal
    const sunday17 = new Date("2026-11-22T22:05:00Z");
    expect(isDue(on, sunday18)).toBe(true);
    expect(isDue(on, sunday17)).toBe(false);
    expect(isDue({ ...on, actif: false }, sunday18)).toBe(false);
    expect(isDue({ ...on, dernierEnvoi: "2026-11-23" }, sunday18)).toBe(false);
    expect(isDue(on, new Date("2026-11-23T23:05:00Z"))).toBe(false); // lundi
  });
});

describe("message de la semaine : familles", () => {
  it("un courriel par famille : deux sœurs ensemble, une fille inscrite deux fois comptée une fois", () => {
    const fams = groupFamilies(
      [
        reg("r1", "Marie@Ex.com", "léa", "roy"),
        reg("r2", "marie@ex.com", "Emma", "Roy", { category_id: "2017" }),
        reg("r3", "marie@ex.com", "Léa ", "Roy"),
        reg("r4", "autre@ex.com", "Zoé", "Gagnon", { is_trial: true }),
        reg("r5", "fin@ex.com", "Mia", "Côté", { is_half_season: true, half_season_ends_on: "2026-11-01" }),
        reg("r6", "pasdecourriel", "Ana", "B"),
        reg("r7", "attente@ex.com", "Ivy", "L", { status: "pending" })
      ],
      "2026-11-19"
    );
    expect(fams).toHaveLength(1);
    expect(fams[0].email).toBe("marie@ex.com");
    expect(fams[0].parentName).toBe("Marie Tremblay");
    expect(fams[0].girls.map((g) => g.firstName)).toEqual(["Léa", "Emma"]);
  });
});

const photo = (id: string, extra: Partial<ChampionPhoto> = {}): ChampionPhoto => ({
  postId: id,
  createdAt: "2026-11-18T20:00:00Z",
  photoUrl: `https://x/${id}.jpg`,
  activityDate: "2026-11-18",
  activityTitle: "Pratique 2015",
  names: ["Léa R.", "Zoé G."],
  championIds: ["z"],
  expectedIds: ["r1", "z"],
  consent: true,
  ...extra
});

describe("message de la semaine : photo des championnes", () => {
  it("seulement d'une pratique de sa fille, seulement avec l'autorisation photo", () => {
    expect(pickChampionPhoto([photo("p1", { expectedIds: ["autre"] })], ["r1"])).toBeNull();
    expect(pickChampionPhoto([photo("p1", { consent: false })], ["r1"])).toBeNull();
    expect(pickChampionPhoto([photo("p1")], ["r1"])?.postId).toBe("p1");
  });

  it("une photo où sa fille est championne passe d'abord, sinon la plus récente", () => {
    const a = photo("a", { createdAt: "2026-11-19T20:00:00Z" });
    const b = photo("b", { createdAt: "2026-11-17T20:00:00Z", championIds: ["r1"] });
    const c = photo("c", { createdAt: "2026-11-18T20:00:00Z" });
    expect(pickChampionPhoto([a, b, c], ["r1"])?.postId).toBe("b");
    expect(pickChampionPhoto([a, c], ["r1"])?.postId).toBe("a");
  });
});

describe("message de la semaine : le courriel", () => {
  const family: Family = {
    email: "marie@ex.com",
    parentName: "Marie Tremblay",
    girls: [
      { registrationId: "r1", firstName: "Léa", lastName: "Roy", category: "2015", seasonId: "s" },
      { registrationId: "r2", firstName: "Emma", lastName: "Roy", category: "2017", seasonId: "s" }
    ]
  };
  const base = { family, weekStart: "2026-11-23", siteUrl: "https://www.newvalkyria.com", photo: null, home: null };

  it("thème de chaque fille, photo et défi maison, sans signature écrite", () => {
    const m = buildWeeklyMessage({
      ...base,
      themes: [
        { registrationId: "r1", theme: "Réduction des espaces" },
        { registrationId: "r2", theme: "Cadrage <couverture>" }
      ],
      photo: photo("p1"),
      home: { challenge: "10 jongles pied gauche", game: { title: "Le miroir", how: "Face à face" }, url: "https://www.newvalkyria.com/lab/abc" }
    })!;
    expect(m.to).toBe("marie@ex.com");
    expect(m.subject).toBe("La semaine de Léa et Emma à New Valkyria");
    expect(m.html).toContain("Bonjour Marie,");
    expect(m.html).toContain("semaine du 23 novembre");
    expect(m.html).toContain("<strong>Léa :</strong> Réduction des espaces");
    expect(m.html).toContain("Cadrage &lt;couverture&gt;");
    expect(m.html).toContain("https://x/p1.jpg");
    expect(m.html).toContain("10 jongles pied gauche");
    expect(m.html).toContain("https://www.newvalkyria.com/lab/abc");
    expect(m.html).not.toMatch(/localhost|Annie|L'équipe New Valkyria/);
    expect(m).toMatchObject({ hasTheme: true, hasPhoto: true, hasChallenge: true });
  });

  it("même thème pour les deux sœurs : écrit une fois ; sans photo : rien sur les championnes", () => {
    const m = buildWeeklyMessage({ ...base, themes: [{ registrationId: "r1", theme: "Aide au porteur" }, { registrationId: "r2", theme: "Aide au porteur" }] })!;
    expect(m.html.match(/Aide au porteur/g)).toHaveLength(1);
    expect(m.html).not.toContain("championnes");
    expect(m.hasChallenge).toBe(false);
  });

  it("rien à dire (ni thème, ni défi) : pas de courriel", () => {
    expect(buildWeeklyMessage({ ...base, themes: [{ registrationId: "r1", theme: null }], photo: photo("p1") })).toBeNull();
    expect(buildWeeklyMessage({ ...base, themes: [], home: { challenge: null, game: null, url: "u" } })).toBeNull();
  });
});

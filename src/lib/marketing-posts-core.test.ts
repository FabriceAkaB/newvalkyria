import { describe, expect, it } from "vitest";

import {
  addDays,
  aggregate,
  bestContent,
  compareBy,
  contentGroups,
  followerGrowth,
  followersByNetwork,
  followerSeries,
  growthSinceLabel,
  marketingDigestLines,
  needsStatsUpdate,
  paceLabel,
  pacePerWeek,
  paidVsOrganic,
  postLabel,
  safeHref,
  socialTodayItems,
  themeKey,
  themeLabel,
  topPosts,
  totalFollowers,
  videosPerWeekKpi,
  weekStart,
  weeklyRhythm,
  type ChannelStatRow,
  type MarketingPost
} from "@/lib/marketing-posts-core";

let seq = 0;
function post(p: Partial<MarketingPost>): MarketingPost {
  seq++;
  return {
    id: seq,
    group_id: p.group_id ?? `g${seq}`,
    network: "instagram",
    format: "reel",
    paid: false,
    posted_on: "2026-11-02",
    url: null,
    title: null,
    theme: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    followers_gained: null,
    spend_cents: null,
    leads: null,
    registrations: null,
    note: null,
    stats_updated_at: null,
    created_at: "2026-11-02T12:00:00Z",
    ...p
  };
}

describe("liens", () => {
  it("seuls les liens http(s) deviennent cliquables", () => {
    expect(safeHref(" https://www.instagram.com/reel/abc ")).toBe("https://www.instagram.com/reel/abc");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,x")).toBeNull();
    expect(safeHref(null)).toBeNull();
  });
});

describe("dates", () => {
  it("semaine du lundi au dimanche", () => {
    expect(weekStart("2026-11-02")).toBe("2026-11-02"); // lundi
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // dimanche
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });
});

describe("thèmes", () => {
  it("regroupe sans accents ni majuscules et garde le libellé connu", () => {
    expect(themeKey("Avant-après")).toBe(themeKey("avant apres"));
    expect(themeLabel("AVANT APRÈS")).toBe("Avant-après");
    expect(themeLabel("journée portes ouvertes")).toBe("Journée portes ouvertes");
    expect(themeLabel(null)).toBe("Sans thème");
  });
  it("titre lisible", () => {
    expect(postLabel({ title: "  Ball mastery U10 ", theme: null, format: "reel" })).toBe("Ball mastery U10");
    expect(postLabel({ title: null, theme: "match", format: "carrousel" })).toBe("Match · Carrousel");
  });
});

describe("rythme de publication", () => {
  const posts = [
    // Même reel sur Instagram et Facebook : 1 seul contenu
    post({ group_id: "a", network: "instagram", posted_on: "2026-10-27" }),
    post({ group_id: "a", network: "facebook", posted_on: "2026-10-27" }),
    post({ group_id: "b", format: "photo", posted_on: "2026-10-28" }),
    post({ group_id: "c", format: "video", posted_on: "2026-11-02" }),
    post({ group_id: "d", posted_on: "2026-10-10" }),
    post({ group_id: "e", posted_on: "2026-11-20" }) // planifiée : pas encore comptée
  ];

  it("compte un contenu publié sur deux réseaux une seule fois", () => {
    const groups = contentGroups(posts);
    expect(groups).toHaveLength(5);
    expect(groups.find((g) => g.groupId === "a")!.networks).toEqual(["instagram", "facebook"]);
  });

  it("barres par semaine, semaine en cours en dernier", () => {
    const bars = weeklyRhythm(posts, "2026-11-04", 4);
    expect(bars.map((b) => b.week)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]);
    expect(bars[2]).toMatchObject({ videos: 1, others: 1, current: false });
    expect(bars[3]).toMatchObject({ videos: 1, others: 0, current: true });
    expect(bars[0]).toMatchObject({ videos: 0, others: 0 });
  });

  it("moyenne des 4 dernières semaines (28 jours)", () => {
    // 2026-10-08 → 2026-11-04 : a, c, d (vidéos) ; b est une photo ; e est dans le futur
    const old = [...posts, post({ group_id: "f", format: "photo", posted_on: "2026-09-01" })];
    expect(pacePerWeek(old, "2026-11-04", true)).toMatchObject({ value: 0.8, count: 3, from: "2026-10-08", weeks: 4, sinceFirst: false });
    expect(pacePerWeek(old, "2026-11-04", false).count).toBe(4);
    expect(pacePerWeek([], "2026-11-04").value).toBeNull();
    expect(videosPerWeekKpi([], "2026-11-04").value).toBeNull();
    const kpi = videosPerWeekKpi(old, "2026-11-04");
    expect(kpi.value).toBe(0.8);
    expect(kpi.note).toContain("3 vidéos");
    expect(kpi.note).toContain("du 8 oct. au 4 nov.");
  });

  it("premier mois : la moyenne part de la toute première publication", () => {
    // Début le 15 nov. : 3 vidéos en 6 jours = 3 par semaine, pas 0,8 (les semaines d'avant ne comptent pas)
    const start = ["a", "b", "c"].map((g, i) => post({ group_id: g, posted_on: `2026-11-${15 + i * 2}` }));
    expect(pacePerWeek(start, "2026-11-20")).toMatchObject({ value: 3, count: 3, from: "2026-11-15", weeks: 1, sinceFirst: true });
    // 9 jours plus tard : 4 vidéos sur 9 jours ≈ 3,1 par semaine
    const more = [...start, post({ group_id: "d", posted_on: "2026-11-23" })];
    expect(pacePerWeek(more, "2026-11-23").value).toBe(3.1);
    expect(videosPerWeekKpi(start, "2026-11-20").note).toContain("du 15 nov. (première publication) au 20 nov.");
    expect(paceLabel(pacePerWeek(start, "2026-11-20"))).toBe("depuis la première publication, le 15 nov.");
    expect(paceLabel(pacePerWeek(more, "2026-12-31"))).toBe("moyenne des 4 dernières semaines");
    // Le jour même de la toute première publication : une semaine au minimum
    expect(pacePerWeek([start[0]], "2026-11-15").value).toBe(1);
    // Seulement des publications planifiées : 0, pas encore de rythme
    expect(pacePerWeek([post({ posted_on: "2026-12-01" })], "2026-11-20")).toMatchObject({ value: 0, count: 0, weeks: 4 });
  });
});

describe("comparaison des contenus", () => {
  const posts = [
    post({ theme: "Avant-après", format: "reel", views: 2000, likes: 150, comments: 20, shares: 20, saves: 10, leads: 6, registrations: 2 }),
    post({ theme: "avant apres", format: "reel", views: 1000, likes: 50, leads: 0 }),
    post({ theme: "Coulisses", format: "photo", views: 4000, likes: 100, leads: 2 }),
    post({ theme: "Match", format: "carrousel", views: null, leads: 1 }),
    post({ theme: null, format: "story", views: 500 })
  ];

  it("agrège vues moyennes, engagement et essais pour 1 000 vues", () => {
    const a = aggregate(posts.slice(0, 2));
    expect(a.posts).toBe(2);
    expect(a.views).toBe(3000);
    expect(a.avgViews).toBe(1500);
    expect(a.engagementRate).toBeCloseTo(250 / 3000);
    expect(a.leadsPer1000).toBe(2);
    expect(a.registrations).toBe(2);
  });

  it("les essais d'une publication sans vues comptent au total mais pas dans le taux", () => {
    const a = aggregate([posts[3]]);
    expect(a.leads).toBe(1);
    expect(a.leadsPer1000).toBeNull();
    expect(a.avgViews).toBeNull();
  });

  it("par thème : regroupe les variantes d'écriture, meilleur taux d'essais en premier", () => {
    const rows = compareBy(posts, "theme");
    expect(rows.map((r) => r.label)).toEqual(["Avant-après", "Coulisses", "Sans thème", "Match"]);
    expect(rows[0].posts).toBe(2);
    expect(rows[1].leadsPer1000).toBe(0.5);
  });

  it("par type et par réseau", () => {
    expect(compareBy(posts, "format")[0].label).toBe("Reel");
    expect(compareBy(posts, "network")).toHaveLength(1);
  });

  it("meilleur contenu : essais d'abord, sinon les vues", () => {
    expect(bestContent(posts)).toMatchObject({ kind: "essais", agg: { label: "Avant-après" } });
    const noLeads = posts.map((p) => ({ ...p, leads: null }));
    expect(bestContent(noLeads)).toMatchObject({ kind: "vues", agg: { label: "Coulisses" } });
    expect(bestContent([])).toBeNull();
  });

  it("top par vues et par essais", () => {
    expect(topPosts(posts, "views", 2).map((p) => p.views)).toEqual([4000, 2000]);
    expect(topPosts(posts, "leads").map((p) => p.leads)).toEqual([6, 2, 1]);
  });
});

describe("organique contre payant", () => {
  it("coût par essai et par inscription", () => {
    const posts = [
      post({ paid: true, spend_cents: 10000, views: 5000, leads: 4, registrations: 1 }),
      post({ paid: true, spend_cents: 5000, views: 3000, leads: 1 }),
      post({ paid: false, views: 1000, leads: 1 })
    ];
    const { organic, paid } = paidVsOrganic(posts);
    expect(organic.posts).toBe(1);
    expect(organic.costPerLeadCents).toBeNull();
    expect(paid.spendCents).toBe(15000);
    expect(paid.costPerLeadCents).toBe(3000);
    expect(paid.costPerRegistrationCents).toBe(15000);
    expect(paid.leadsPer1000).toBe(0.6);
  });
});

describe("chiffres à relever", () => {
  it("7 à 60 jours après, tant que les chiffres n'ont pas été relevés après le 7e jour", () => {
    expect(needsStatsUpdate(post({ posted_on: "2026-10-30" }), "2026-11-04")).toBe(false);
    expect(needsStatsUpdate(post({ posted_on: "2026-10-28" }), "2026-11-04")).toBe(true);
    expect(needsStatsUpdate(post({ posted_on: "2026-10-28", stats_updated_at: "2026-10-28T20:00:00Z" }), "2026-11-04")).toBe(true);
    expect(needsStatsUpdate(post({ posted_on: "2026-10-28", stats_updated_at: "2026-11-04T15:00:00Z" }), "2026-11-04")).toBe(false);
    expect(needsStatsUpdate(post({ posted_on: "2026-08-01" }), "2026-11-04")).toBe(false);
  });
});

describe("abonnés", () => {
  const rows: ChannelStatRow[] = [
    { id: 1, channel: "instagram", measured_at: "2026-09-01", followers: 1000 },
    { id: 2, channel: "instagram", measured_at: "2026-10-01", followers: 1100 },
    { id: 3, channel: "instagram", measured_at: "2026-10-20", followers: 1150 },
    { id: 4, channel: "instagram", measured_at: "2026-11-02", followers: 1190 },
    { id: 5, channel: "instagram", measured_at: "2026-11-02", followers: 1200 }, // correction le même jour
    { id: 6, channel: "facebook", measured_at: "2026-10-25", followers: 400 },
    { id: 7, channel: "facebook", measured_at: "2026-11-02", followers: 410 },
    { id: 8, channel: "youtube", measured_at: "2026-11-02", followers: 50 },
    { id: 9, channel: "pub_meta", measured_at: "2026-11-02", followers: null, spend_cents: 5000, leads: 3 }
  ];

  it("un relevé par jour, le dernier entré", () => {
    expect(followerSeries(rows, "instagram")).toEqual([
      { date: "2026-09-01", followers: 1000 },
      { date: "2026-10-01", followers: 1100 },
      { date: "2026-10-20", followers: 1150 },
      { date: "2026-11-02", followers: 1200 }
    ]);
  });

  it("croissance depuis le relevé le plus proche de 30 jours avant le dernier", () => {
    expect(followerGrowth(followerSeries(rows, "instagram"))).toEqual({ current: 1200, at: "2026-11-02", delta: 100, since: "2026-10-01" });
    // Pas de relevé vers 30 jours avant : depuis le plus proche (le premier)
    expect(followerGrowth(followerSeries(rows, "facebook"))).toEqual({ current: 410, at: "2026-11-02", delta: 10, since: "2026-10-25" });
    // Un seul relevé : pas encore de croissance
    expect(followerGrowth(followerSeries(rows, "youtube")).delta).toBeNull();
    expect(followerGrowth([]).current).toBeNull();
    // Aux 2 semaines : le relevé d'il y a 28 jours plutôt que celui d'il y a 42
    const biweekly = [
      { date: "2026-09-21", followers: 900 },
      { date: "2026-10-05", followers: 950 },
      { date: "2026-10-19", followers: 990 },
      { date: "2026-11-02", followers: 1000 }
    ];
    expect(followerGrowth(biweekly)).toMatchObject({ delta: 50, since: "2026-10-05" });
    // Dernier relevé ancien : la croissance reste visible (2 relevés en septembre)
    expect(followerGrowth([{ date: "2026-09-01", followers: 100 }, { date: "2026-09-20", followers: 130 }])).toMatchObject({ delta: 30, since: "2026-09-01" });
  });

  it("libellé de la période du gain", () => {
    expect(growthSinceLabel("2026-10-01", "2026-11-02")).toBe("en 30 jours");
    expect(growthSinceLabel("2026-10-05", "2026-11-02")).toBe("en 30 jours");
    expect(growthSinceLabel("2026-10-25", "2026-11-02")).toBe("depuis le 25 oct.");
    // 62 jours : jamais « en 30 jours »
    expect(growthSinceLabel("2026-09-01", "2026-11-02")).toBe("depuis le 1er sept.");
    expect(growthSinceLabel(null, "2026-11-02")).toBe("");
  });

  it("total de tous les réseaux", () => {
    const nets = followersByNetwork(rows);
    expect(nets.map((n) => n.network)).toEqual(["instagram", "facebook", "youtube", "tiktok"]);
    expect(totalFollowers(nets)).toEqual({ current: 1660, delta: 110, since: "2026-10-01", lastReading: "2026-11-02" });
  });
});

describe("Aujourd'hui et résumé du lundi", () => {
  const stats: ChannelStatRow[] = [{ id: 1, channel: "instagram", measured_at: "2026-10-01", followers: 1000 }];

  it("vidéos en retard à partir du jeudi, chiffres à relever, abonnés à entrer", () => {
    const posts = [post({ group_id: "x", posted_on: "2026-11-02" }), post({ group_id: "y", format: "photo", posted_on: "2026-10-26", title: "Coulisses du camp" })];
    // Lundi : la photo du 26 octobre a 7 jours (chiffres à relever) ; dernier relevé d'abonnés il y a 32 jours
    const monday = socialTodayItems(posts, stats, "2026-11-02");
    expect(monday.level).toBe("info");
    expect(monday.items.map((i) => i.title)).toEqual(["Relever les chiffres de 1 publication", "Entrer les abonnés de chaque réseau"]);
    expect(monday.items[0].detail).toBe("Coulisses du camp (Instagram)");
    expect(monday.items[1].detail).toBe("Dernier relevé il y a 32 jours");
    // Jeudi : 1 vidéo sur 3 cette semaine
    const fresh: ChannelStatRow[] = [{ id: 2, channel: "facebook", measured_at: "2026-11-01", followers: 10 }];
    const thursday = socialTodayItems(posts, fresh, "2026-11-05");
    expect(thursday.level).toBe("orange");
    expect(thursday.items.map((i) => i.title)).toEqual(["Cette semaine : 1 vidéo sur 3", "Relever les chiffres de 1 publication"]);
    expect(thursday.items[0].meta).toBe("Il reste 4 jours, aujourd'hui compris");
    // Dimanche : chiffres relevés après le 7e jour, plus rien à relever
    const relevee = posts.map((p) => (p.group_id === "y" ? { ...p, stats_updated_at: "2026-11-03T15:00:00Z" } : p));
    const sunday = socialTodayItems(relevee, fresh, "2026-11-08");
    expect(sunday.items.map((i) => i.title)).toEqual(["Cette semaine : 1 vidéo sur 3"]);
    expect(sunday.items[0].meta).toBe("Dernier jour de la semaine");
    expect(socialTodayItems(posts, [], "2026-11-03").items.at(-1)?.detail).toBe("Aucun relevé : c'est le point de départ de la croissance");
  });

  it("3 vidéos dans la semaine : rien à faire de ce côté", () => {
    const posts = ["a", "b", "c"].map((g) => post({ group_id: g, posted_on: "2026-11-03" }));
    const r = socialTodayItems(posts, [{ id: 2, channel: "facebook", measured_at: "2026-11-01", followers: 10 }], "2026-11-06");
    expect(r.items).toEqual([]);
  });

  it("résumé du lundi", () => {
    const posts = [
      post({ group_id: "a", posted_on: "2026-10-27", views: 1000, leads: 2, theme: "Avant-après" }),
      post({ group_id: "a", network: "facebook", posted_on: "2026-10-27", views: 500, leads: 1, theme: "Avant-après" }),
      post({ group_id: "b", posted_on: "2026-10-29", paid: true, spend_cents: 6000, views: 3000, leads: 2, registrations: 1 })
    ];
    const lines = marketingDigestLines(posts, [...stats, { id: 2, channel: "instagram", measured_at: "2026-11-02", followers: 1040 }], "2026-11-02");
    // Première publication le 27 oct. : 2 vidéos en 7 jours
    expect(lines[0]).toBe("Vidéos : 2 par semaine (depuis la première publication, le 27 oct. ; cible 3, idéal 5).");
    expect(lines[1]).toBe(`Abonnés : ${(1040).toLocaleString("fr-CA")} (+40 en 30 jours).`);
    expect(lines[2]).toContain("Semaine dernière : 2 publications");
    expect(lines[2]).toContain("5 essais, 1 inscription");
    expect(lines[3]).toContain("60 $ dépensés, 2 essais, 1 inscription ; 30 $ par essai, 60 $ par inscription");
    expect(lines[4]).toBe("Contenu qui amène le plus d'essais : Avant-après (2 pour 1 000 vues).");
  });
});

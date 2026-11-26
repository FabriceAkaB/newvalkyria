import { describe, expect, it } from "vitest";

import { bulletinNews, buildDigests, championNews, composeEmail, isEnabled, joinNames, noticeId, videoNews, type NewsItem } from "@/lib/parent-notifications";

const SITE = "https://www.newvalkyria.com";
const item = (over: Partial<NewsItem>): NewsItem => ({ key: "video:1", kind: "video", registrationId: "r1", firstName: "Justine", date: "2026-11-19", text: "une nouvelle vidéo", path: "/compte/progression", ...over });

describe("avis aux parents", () => {
  it("actif par défaut, coupé par false / 0 / non / off", () => {
    expect(isEnabled(null)).toBe(true);
    expect(isEnabled("true")).toBe(true);
    for (const v of ["false", "0", "non", "OFF", " off "]) expect(isEnabled(v)).toBe(false);
  });

  it("bulletin annoncé à sa date de remise et dans les jours qui suivent, jamais avant, seulement avec des présences", () => {
    const regs = [
      { registrationId: "r1", firstName: "Justine", seasonId: "automne-hiver-2026", hasActivity: true, evaluated: { "mi-saison": 4, "fin-saison": 9 } },
      { registrationId: "r2", firstName: "Léa", seasonId: "automne-hiver-2026", hasActivity: false, evaluated: { "mi-saison": 6, "fin-saison": 6 } },
      // Moins de 4 pratiques évaluées : le bulletin n'est pas remis, donc pas annoncé (JP, 26 nov. 2026).
      { registrationId: "r3", firstName: "Maya", seasonId: "automne-hiver-2026", hasActivity: true, evaluated: { "mi-saison": 3 } }
    ];
    expect(bulletinNews(regs, "2026-12-14")).toEqual([]);
    const at = bulletinNews(regs, "2026-12-15");
    expect(at).toHaveLength(1);
    expect(at[0]).toMatchObject({ key: "bulletin:r1:mi-saison", path: "/compte/progression?bulletin=mi-saison" });
    expect(bulletinNews(regs, "2026-12-20")).toHaveLength(1);
    expect(bulletinNews(regs, "2027-01-20")).toEqual([]);
    expect(bulletinNews(regs, "2027-04-18")[0].key).toBe("bulletin:r1:fin-saison");
  });

  it("vidéos et championnes récentes seulement ; une publication retirée n'est pas annoncée", () => {
    const v = videoNews([
      { id: "v1", registrationId: "r1", firstName: "Justine", checkpoint: "mi", title: "Ball mastery", createdAt: "2026-11-19T15:00:00Z" },
      { id: "v2", registrationId: "r1", firstName: "Justine", checkpoint: "debut", title: "Ball mastery", createdAt: "2026-09-10T15:00:00Z" }
    ], "2026-11-19");
    expect(v.map((x) => x.key)).toEqual(["video:v1"]);
    expect(v[0].text).toContain("mi-saison");
    const c = championNews([
      { postId: "p1", registrationId: "r1", firstName: "Justine", kind: "attitude", title: null, points: 10, activityDate: "2026-11-18", hidden: false, createdAt: "2026-11-18T23:00:00Z" },
      { postId: "p2", registrationId: "r1", firstName: "Justine", kind: "individuel", title: null, points: 10, activityDate: "2026-11-18", hidden: true, createdAt: "2026-11-18T23:00:00Z" }
    ], "2026-11-19");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ key: "champion:p1:r1", path: "/compte/points" });
    expect(c[0].text).toContain("18 novembre");
  });

  it("un seul courriel par adresse, toutes les filles ensemble, sans ce qui est déjà annoncé", () => {
    const items = [
      item({ key: "champion:p1:r1", kind: "champion", path: "/compte/points" }),
      item({ key: "video:v1" }),
      item({ key: "video:v2", registrationId: "r2", firstName: "Léa" }),
      item({ key: "video:v3", registrationId: "r3", firstName: "Zoé" })
    ];
    const recipients = new Map([
      ["r1", ["Maman@Ex.com", "papa@ex.com"]],
      ["r2", ["maman@ex.com"]],
      ["r3", ["pas-une-adresse"]]
    ]);
    const digests = buildDigests({ items, recipients, alreadySent: new Set([noticeId("video:v1", "papa@ex.com")]), sentToday: new Set(), siteUrl: SITE });
    expect(digests.map((d) => d.email)).toEqual(["maman@ex.com", "papa@ex.com"]);
    const maman = digests[0];
    expect(maman.items.map((i) => i.key)).toEqual(["video:v1", "video:v2", "champion:p1:r1"]);
    expect(maman.subject).toBe("Du nouveau pour Justine et Léa dans votre espace famille");
    expect(maman.url).toBe(`${SITE}/compte/progression`);
    expect(digests[1].items.map((i) => i.key)).toEqual(["champion:p1:r1"]);
    expect(digests[1].url).toBe(`${SITE}/compte/points`);
  });

  it("une adresse qui a déjà reçu son résumé aujourd'hui attend demain", () => {
    const digests = buildDigests({ items: [item({})], recipients: new Map([["r1", ["a@ex.com"]]]), alreadySent: new Set(), sentToday: new Set(["a@ex.com"]), siteUrl: SITE });
    expect(digests).toEqual([]);
  });

  it("le courriel : vouvoiement, liens complets, aucun nom échappé mal, pas de signature", () => {
    const mail = composeEmail([item({ firstName: "Ana <b>" })], SITE);
    expect(mail.html).toContain("Ana &lt;b&gt;");
    expect(mail.html).toContain(`${SITE}/compte/progression`);
    expect(mail.text).toContain("Créez-le");
    expect(mail.html).not.toMatch(/Annie|localhost/);
    expect(joinNames(["A", "B", "C"])).toBe("A, B et C");
  });
});

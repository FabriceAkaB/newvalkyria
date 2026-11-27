import { describe, expect, it } from "vitest";

import { awayMatches, categoryLabel, gameLabel, groupOpponents, type OpponentTeamRow } from "@/lib/match-opponents";

const team = (o: Partial<OpponentTeamRow>): OpponentTeamRow => ({
  id: Math.random().toString(36).slice(2),
  org_name: "Dollard SC",
  org_key: "dollard",
  team_label: "F2016",
  team_gender: "filles",
  team_birth_year: 2016,
  team_birth_year_to: 2016,
  team_level: "AA",
  team_players: 12,
  team_count: 1,
  contact_name: "Marie",
  contact_email: "marie@dollard.ca",
  contact_phone: "514",
  notes: null,
  created_at: "2026-11-01",
  ...o
});

describe("adversaires", () => {
  it("regroupe les équipes et les matchs payés par club", () => {
    const list = groupOpponents(
      [team({}), team({ team_label: "F2015", team_birth_year: 2015, team_birth_year_to: 2015, team_count: 2 }), team({ org_name: "JF Prépa", org_key: "jfprepa", contact_email: "a@jf.ca" })],
      [
        { org_key: "dollard", org_name: "Dollard SC", status: "paid", price_cents: 15000, slot_date: "2026-11-07" },
        { org_key: "dollard", org_name: "Dollard SC", status: "paid", price_cents: 15000, slot_date: "2026-12-20" },
        { org_key: "dollard", org_name: "Dollard SC", status: "cancelled", price_cents: 15000, slot_date: "2026-11-30" }
      ],
      "2026-11-27"
    );
    const d = list.find((o) => o.key === "dollard")!;
    expect(d.teams).toHaveLength(2);
    expect(d.teamTotal).toBe(3);
    expect(d.contacts).toHaveLength(1);
    expect(d).toMatchObject({ matchesPaid: 2, paidCents: 30000, lastMatch: "2026-11-07", nextMatch: "2026-12-20", archived: false });
    expect(list[0].key).toBe("dollard");
  });

  it("un club est archivé quand toutes ses équipes le sont", () => {
    const [o] = groupOpponents([team({ archived_at: "2026-11-27" }), team({ archived_at: "2026-11-27" })], [], "2026-11-27");
    expect(o.archived).toBe(true);
    const [p] = groupOpponents([team({ archived_at: "2026-11-27" }), team({})], [], "2026-11-27");
    expect(p.archived).toBe(false);
  });

  it("écrit la catégorie", () => {
    expect(categoryLabel(team({ team_gender: "garcons", team_birth_year: 2015, team_birth_year_to: 2014, team_level: "Compétitif" }))).toBe("Garçons · 2014-2015 · Compétitif");
  });

  it("trouve les matchs qui ne sont sur aucune de nos plages", () => {
    const games = [
      { date: "2026-12-12", start: "16:30", end: "18:00", team: "Équipe 2015 INT", title: "Hors-concours Équipe 2015 INT c. JF Prépa", location: "Laval", type: "Match" },
      { date: "2026-12-13", start: "16:30", end: "18:30", team: "Équipe 2016-2017 AV", title: "Pre-season Équipe 2016-2017 AV vs. À déterminer", location: "Terrebonne", type: "Match" },
      { date: "2026-12-14", start: "18:00", end: "19:30", team: "Lundi", title: "Pratique", location: null, type: "Pratique" },
      { date: "2026-12-19", start: "10:00", end: "11:00", team: "Équipe 2015 AV", title: "ANNULÉE : match", location: null, type: "Match" },
      { date: "2026-11-20", start: "10:00", end: "11:00", team: "Équipe 2015 AV", title: "passé", location: null, type: "Match" }
    ];
    const away = awayMatches(games, [{ slot_date: "2026-12-13", start_time: "16:30" }], "2026-11-27");
    expect(away.map((g) => g.date)).toEqual(["2026-12-12"]);
    expect(gameLabel(away[0].title)).toBe("Équipe 2015 INT c. JF Prépa");
  });
});

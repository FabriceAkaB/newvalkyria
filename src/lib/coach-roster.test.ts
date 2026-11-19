// @vitest-environment node
import { describe, expect, it } from "vitest";

import { rosterForActivity, type RosterRegistration, type RosterSlot } from "@/lib/coach-portal-repo";

const slots: RosterSlot[] = [
  { id: "lun-18-2016", day: "Lundi", start_time: "18:00", cats: ["2016"] },
  { id: "mer-18-2016", day: "Mercredi", start_time: "18:00", cats: ["2016"] },
  { id: "lun-1930-2015", day: "Lundi", start_time: "19:30", cats: ["2015"] }
];
const reg = (id: string, over: Partial<RosterRegistration>): RosterRegistration => ({
  id,
  player_first_name: id,
  player_last_name: "X",
  category_id: "2016",
  is_trial: false,
  trial_date: null,
  advanced_group: false,
  status: "paid",
  time_slot_template_id: "lun-18-2016",
  players: null,
  ...over
});

describe("rosterForActivity", () => {
  const regs = [
    reg("lea", {}),
    reg("mia", { time_slot_template_id: "mer-18-2016" }),
    reg("zoe", { status: "pending" }),
    reg("essai-lundi", { is_trial: true, trial_date: "2026-11-02" }),
    reg("essai-mercredi", { is_trial: true, trial_date: "2026-11-04", time_slot_template_id: "mer-18-2016" }),
    reg("ines", { category_id: "2015", time_slot_template_id: "lun-1930-2015" })
  ];

  it("prend les inscrites de la plage du lundi 18 h, pas toute la catégorie, plus l'essai du jour", () => {
    const r = rosterForActivity({ activity_date: "2026-11-02", start_time: "18:05:00", category: "Filles 2016" }, slots, regs);
    expect(r.map((p) => p.registrationId)).toEqual(["lea", "essai-lundi"]);
  });

  it("sans plage correspondante, prend toute la catégorie payée", () => {
    const r = rosterForActivity({ activity_date: "2026-11-01", start_time: "10:00", category: "2016" }, slots, regs);
    expect(r.map((p) => p.registrationId).sort()).toEqual(["lea", "mia"]);
  });

  it("sans catégorie, personne", () => {
    expect(rosterForActivity({ activity_date: "2026-11-02", start_time: "18:00", category: null }, slots, regs)).toEqual([]);
  });
});

describe("pratique d'équipe sans plage (dimanche)", () => {
  const teamSlots: RosterSlot[] = [...slots, { id: "lun-18-av", day: "Lundi", start_time: "18:00", cats: ["2016", "2017"], advanced_only: true }];
  const regs = [
    reg("av", { time_slot_template_id: "lun-18-av" }),
    reg("av-flag", { advanced_group: true, time_slot_template_id: "mer-18-2016" }),
    reg("int", { time_slot_template_id: "mer-18-2016" }),
    reg("autre-age", { category_id: "2015", time_slot_template_id: "lun-1930-2015" })
  ];
  const ids = (category: string) => rosterForActivity({ activity_date: "2026-11-15", start_time: "16:30", category }, teamSlots, regs).map((p) => p.registrationId).sort();

  it("AV : les avancées des années de l'équipe ; INT : les autres ; AV et INT : toutes", () => {
    expect(ids("Équipe 2016-2017 AV")).toEqual(["av", "av-flag"]);
    expect(ids("Équipe 2016-2017 INT")).toEqual(["int"]);
    expect(ids("Équipe 2016-2017 AV et INT")).toEqual(["av", "av-flag", "int"]);
  });
});

import { describe, expect, it } from "vitest";

import { alignAttendance, attendanceRate } from "@/lib/player-attendance";

const act = (id: string, date: string, mcsExpected: string[] | null, mcsCancelled = false) => ({ id, date, mcsExpected, mcsCancelled });

describe("présence d'une joueuse : MonClubSportif fait foi (JP, 26 nov. 2026)", () => {
  it("pratiques attendues selon MCS, sans les annulées, avec « pas de réponse » quand rien n'est noté", () => {
    const a1 = act("a1", "2026-11-02", ["r1", "r2"]);
    const a2 = act("a2", "2026-11-09", ["r1"], true); // annulée dans MCS
    const a3 = act("a3", "2026-11-16", ["r2"]); // r1 pas assignée
    const a4 = act("a4", "2026-11-23", ["r1"]); // attendue, aucune ligne
    const a5 = act("a5", "2026-10-26", null); // jamais lue dans MCS : ligne gardée telle quelle
    const a6 = act("a6", "2026-11-26", ["r1"]); // aujourd'hui : pas encore « sans réponse »
    const a7 = act("a7", "2026-11-18", ["r2"]); // pas assignée, mais venue quand même
    const rows = [
      { activityId: "a1", status: "present", activity: a1 },
      { activityId: "a2", status: "absent", activity: a2 },
      { activityId: "a3", status: "absent", activity: a3 },
      { activityId: "a5", status: "late", activity: a5 },
      { activityId: "a7", status: "present", activity: a7 }
    ];
    const { keep, missing } = alignAttendance("r1", rows, [a1, a2, a4, a6], "2026-11-26");
    expect(keep.map((i) => rows[i].activityId)).toEqual(["a1", "a5", "a7"]);
    expect(missing.map((m) => m.id)).toEqual(["a4"]);
    const r = attendanceRate([...keep.map((i) => rows[i].status), ...missing.map(() => "unknown")]);
    expect(r).toEqual({ present: 3, total: 4, rate: 75 });
    expect(attendanceRate([])).toEqual({ present: 0, total: 0, rate: null });
  });
});

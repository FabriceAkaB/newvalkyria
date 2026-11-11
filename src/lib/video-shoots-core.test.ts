import { describe, expect, it } from "vitest";

import { PLAN } from "@/lib/mandalart-plan";
import { groupShoots, missingForShoot, nextStatus, SERIES, SHOOT_IDEAS, type Shoot } from "@/lib/video-shoots-core";

const codes = new Set(PLAN.pillars.flatMap((p) => p.objectives.flatMap((o) => o.tasks.map((t) => t.code))));
const s = (over: Partial<Shoot>): Shoot => ({ id: "x", title: "t", series: "reseaux", status: "idee", shoot_on: null, shoot_time: null, place: null, message: null, hook: null, shots: null, people: null, gear: null, format: null, mandalart_code: null, note: null, sort_order: 0, ...over });

describe("Tournages", () => {
  it("les idées visent une série et une tâche du Mandalart qui existent", () => {
    expect(SHOOT_IDEAS.filter((i) => !SERIES.some((x) => x.id === i.series) || !codes.has(i.code))).toEqual([]);
  });
  it("avance d'une étape jusqu'à publié", () => {
    expect([nextStatus("idee"), nextStatus("monte"), nextStatus("publie")]).toEqual(["planifie", "publie", null]);
  });
  it("dit ce qui manque pour tourner sans réfléchir", () => {
    expect(missingForShoot(s({ shoot_on: "2026-11-12", shoot_time: "7 h 30", place: "Blainville", message: "m", hook: "h" }))).toEqual(["Les plans à filmer"]);
  });
  it("range demain, en retard, à finir et idées", () => {
    const g = groupShoots(
      [s({ id: "a", status: "planifie", shoot_on: "2026-11-12" }), s({ id: "b", status: "planifie", shoot_on: "2026-11-10" }), s({ id: "c", status: "tourne" }), s({ id: "d" }), s({ id: "e", status: "planifie", shoot_on: "2026-11-20" })],
      "2026-11-11",
      "2026-11-12"
    );
    expect([g.tomorrow.map((x) => x.id), g.late.map((x) => x.id), g.toFinish.map((x) => x.id), g.ideas.map((x) => x.id), g.upcoming.map((x) => x.id)]).toEqual([["a"], ["b"], ["c"], ["d"], ["e"]]);
  });
});

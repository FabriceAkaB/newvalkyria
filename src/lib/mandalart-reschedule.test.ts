import { describe, expect, it } from "vitest";

import { rescheduleTasks, type SchedTask } from "@/lib/mandalart-reschedule";

const t = (code: string, due: string | null, extra: Partial<SchedTask> = {}): SchedTask => ({ code, objective: "P1.2", due, status: "a_faire", fixed: false, ...extra });

describe("rescheduleTasks", () => {
  it("reporte à aujourd'hui une tâche pas faite à sa date", () => {
    expect(rescheduleTasks([t("P1.2.01", "2026-11-01")], "2026-11-02")).toEqual([{ code: "P1.2.01", from: "2026-11-01", to: "2026-11-02", reason: "retard" }]);
  });

  it("ne touche pas aux tâches faites, abandonnées, sans date ou à venir", () => {
    expect(
      rescheduleTasks([t("a", "2026-10-01", { status: "fait" }), t("b", "2026-10-01", { status: "abandonne" }), t("c", null), t("d", "2026-12-01")], "2026-11-02")
    ).toEqual([]);
  });

  it("une tâche à date fixe ne bouge jamais", () => {
    expect(rescheduleTasks([t("fixe", "2026-10-20", { fixed: true })], "2026-11-02")).toEqual([]);
  });

  it("reporte la première au lendemain et réorganise la suite une par jour, sans toucher aux tâches fixes ni lointaines", () => {
    const changes = rescheduleTasks(
      [
        t("P1.2.01", "2026-10-25"),
        t("P1.2.02", "2026-11-01"), // en retard aussi : le jour d'après
        t("P1.2.03", "2026-11-06"), // rattrapée : glisse derrière
        t("P1.2.04", "2026-11-06", { fixed: true }), // fixe : ne bouge pas
        t("P1.2.05", "2026-11-30"), // loin : garde sa date
        t("P1.3.01", "2026-10-30", { objective: "P1.3" })
      ],
      "2026-11-05"
    );
    expect(changes).toEqual([
      { code: "P1.2.01", from: "2026-10-25", to: "2026-11-05", reason: "retard" },
      { code: "P1.2.02", from: "2026-11-01", to: "2026-11-06", reason: "retard" },
      { code: "P1.2.03", from: "2026-11-06", to: "2026-11-07", reason: "suite" },
      { code: "P1.3.01", from: "2026-10-30", to: "2026-11-05", reason: "retard" }
    ]);
  });

  it("le lendemain, une tâche toujours pas faite repousse encore la suite d'un jour", () => {
    const changes = rescheduleTasks([t("P1.2.01", "2026-11-05"), t("P1.2.02", "2026-11-06"), t("P1.2.03", "2026-11-07")], "2026-11-06");
    expect(changes.map((c) => [c.code, c.to])).toEqual([
      ["P1.2.01", "2026-11-06"],
      ["P1.2.02", "2026-11-07"],
      ["P1.2.03", "2026-11-08"]
    ]);
  });
});

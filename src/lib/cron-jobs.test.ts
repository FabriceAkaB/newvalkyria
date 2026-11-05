import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { backupShouldSkip, CRON_JOBS, CRON_NAMES, cronAlerts, cronPath, type CronRunRow } from "@/lib/cron-jobs";

describe("tâches automatiques", () => {
  it("la liste correspond exactement à vercel.json, et chaque tâche a sa route et passe par la porte commune", () => {
    const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8")).crons as { path: string; schedule: string }[];
    const fromVercel = vercel.map((c) => `${c.path} ${c.schedule}`).sort();
    const fromList = CRON_NAMES.flatMap((n) => CRON_JOBS[n].vercel.map((s) => `${cronPath(n)} ${s}`)).sort();
    expect(fromList).toEqual(fromVercel);
    for (const n of CRON_NAMES) {
      const route = fs.readFileSync(`src/app/api/cron/${n}/route.ts`, "utf8");
      expect(route).toContain(`cronGate(request, "${n}"`);
      expect(CRON_JOBS[n].backup.length).toBe(CRON_JOBS[n].vercel.length);
    }
  });

  it("le secours ne refait rien si Vercel a roulé dans la fenêtre", () => {
    const now = new Date("2026-11-05T13:25:00Z");
    expect(backupShouldSkip("mcs-robot", "2026-11-05T13:05:00Z", now)).toBe(true);
    expect(backupShouldSkip("mcs-robot", "2026-11-05T12:05:00Z", now)).toBe(false);
    expect(backupShouldSkip("mcs-robot", null, now)).toBe(false);
    expect(backupShouldSkip("charge-installments", "2026-11-05T04:00:00Z", new Date("2026-11-05T04:20:00Z"))).toBe(true);
  });

  it("alerte : tâche en retard, jamais roulée, secret Vercel refusé", () => {
    const now = new Date("2026-11-05T16:00:00Z");
    const runs: CronRunRow[] = [
      { name: "mcs-robot", source: "secours", ok: true, ran_at: "2026-11-05T15:25:00Z" },
      { name: "mcs-robot", source: "vercel", ok: false, ran_at: "2026-11-05T15:05:00Z" },
      { name: "charge-installments", source: "vercel", ok: true, ran_at: "2026-11-03T04:00:00Z" }
    ];
    const alerts = cronAlerts(runs, now, "2026-11-04T00:00:00Z");
    expect(alerts.find((a) => a.name === "mcs-robot")?.detail).toMatch(/CRON_SECRET/);
    expect(alerts.some((a) => a.name === "mcs-robot" && /Aucun passage/.test(a.detail))).toBe(false);
    expect(alerts.find((a) => a.name === "charge-installments")?.detail).toMatch(/Aucun passage depuis 60 h/);
    expect(alerts.find((a) => a.name === "mcs-sync")?.detail).toMatch(/Jamais roulé/);
    expect(cronAlerts([], now, "2026-11-05T15:00:00Z")).toEqual([]);
  });
});

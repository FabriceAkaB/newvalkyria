import { describe, expect, it } from "vitest";
import { isDaytime, reminderDue } from "@/lib/survey-reminders";

describe("relances des sondages", () => {
  const sent = "2026-11-19T00:25:00Z";
  it("2, 5 puis 7 jours après l'envoi, 3 au plus", () => {
    expect(reminderDue(sent, 0, new Date("2026-11-20T15:00:00Z"))).toBe(false);
    expect(reminderDue(sent, 0, new Date("2026-11-21T15:00:00Z"))).toBe(true);
    expect(reminderDue(sent, 1, new Date("2026-11-22T15:00:00Z"))).toBe(false);
    expect(reminderDue(sent, 1, new Date("2026-11-24T15:00:00Z"))).toBe(true);
    expect(reminderDue(sent, 2, new Date("2026-11-26T15:00:00Z"))).toBe(true);
    expect(reminderDue(sent, 3, new Date("2026-12-30T15:00:00Z"))).toBe(false);
    expect(reminderDue(null, 0, new Date("2026-12-30T15:00:00Z"))).toBe(false);
  });
  it("seulement le jour", () => {
    expect(isDaytime(new Date("2026-11-21T15:00:00Z"))).toBe(true); // 10 h à Montréal
    expect(isDaytime(new Date("2026-11-21T03:00:00Z"))).toBe(false); // 22 h la veille
  });
});

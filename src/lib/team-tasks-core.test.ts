import { describe, expect, it } from "vitest";

import { bucketOf, byDue, isJpOwner, reminderKind, weekEnd } from "@/lib/team-tasks-core";

describe("espace JP : tâches et délégation", () => {
  it("range chaque tâche : en retard, aujourd'hui, cette semaine, plus tard", () => {
    // vendredi 6 novembre 2026
    expect(weekEnd("2026-11-06")).toBe("2026-11-08");
    expect(weekEnd("2026-11-08")).toBe("2026-11-08");
    expect(bucketOf("2026-11-05", "2026-11-06")).toBe("retard");
    expect(bucketOf("2026-11-06", "2026-11-06")).toBe("aujourdhui");
    expect(bucketOf("2026-11-08", "2026-11-06")).toBe("semaine");
    expect(bucketOf("2026-11-09", "2026-11-06")).toBe("plus-tard");
    expect(bucketOf(null, "2026-11-06")).toBe("sans-date");
  });

  it("reconnaît les tâches du Mandalart qui reviennent à JP", () => {
    expect(isJpOwner("JP")).toBe(true);
    expect(isJpOwner("JP + Claude Code")).toBe(true);
    expect(isJpOwner("JP + caméra")).toBe(true);
    expect(isJpOwner("Claude Code")).toBe(false);
    expect(isJpOwner("Christine Durand")).toBe(false);
    expect(isJpOwner(null)).toBe(false);
  });

  it("rappelle la veille puis aux 2 jours en retard, jamais à JP ni deux fois le même jour", () => {
    const t = { status: "a_faire" as const, assignee: "Christine Durand", assignee_email: "c@x.ca", due: "2026-11-07", reminded_at: null };
    expect(reminderKind(t, "2026-11-06")).toBe("veille");
    expect(reminderKind({ ...t, reminded_at: "2026-11-06T14:00:00Z" }, "2026-11-06")).toBeNull();
    expect(reminderKind(t, "2026-11-05")).toBeNull();
    expect(reminderKind(t, "2026-11-08")).toBe("retard");
    expect(reminderKind({ ...t, reminded_at: "2026-11-08T14:00:00Z" }, "2026-11-09")).toBeNull();
    expect(reminderKind({ ...t, reminded_at: "2026-11-08T14:00:00Z" }, "2026-11-10")).toBe("retard");
    expect(reminderKind({ ...t, status: "fait" }, "2026-11-06")).toBeNull();
    expect(reminderKind({ ...t, assignee: "JP" }, "2026-11-06")).toBeNull();
    expect(reminderKind({ ...t, assignee_email: null }, "2026-11-06")).toBeNull();
  });

  it("trie par échéance, les tâches sans date à la fin", () => {
    const xs = [{ due: null }, { due: "2026-11-10" }, { due: "2026-11-02" }];
    expect(xs.sort(byDue).map((x) => x.due)).toEqual(["2026-11-02", "2026-11-10", null]);
  });
});

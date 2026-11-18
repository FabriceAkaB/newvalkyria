import { describe, expect, it } from "vitest";

import { moduleState, TRAINING_MODULES, trainingProgress } from "@/lib/coach-training";

describe("formation des éducateurs", () => {
  it("un module est à lire, puis à valider par JP, puis validé", () => {
    expect(moduleState(undefined)).toBe("a_lire");
    expect(moduleState({ module: "seance", read_at: "x", validated_at: null })).toBe("a_valider");
    expect(moduleState({ module: "seance", read_at: "x", validated_at: "y" })).toBe("valide");
  });
  it("prêt à diriger un groupe quand tous les modules sont validés", () => {
    const some = trainingProgress([{ module: "obligatoire", read_at: "x", validated_at: "y" }, { module: "seance", read_at: "x", validated_at: null }]);
    expect(some).toMatchObject({ read: 2, validated: 1, total: TRAINING_MODULES.length, certified: false });
    expect(some.next?.key).toBe("principes");
    const all = trainingProgress(TRAINING_MODULES.map((m) => ({ module: m.key, read_at: "x", validated_at: "y" })));
    expect(all.certified).toBe(true);
    expect(all.next).toBeNull();
  });
});

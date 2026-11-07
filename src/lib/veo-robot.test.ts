import { describe, expect, it } from "vitest";

import { veoSlugOf } from "@/lib/veo-robot";

describe("lien Veo", () => {
  it("code tiré du lien", () => {
    expect(veoSlugOf("https://app.veo.co/matches/20261101-match-nov-1-2026-v29cc184/")).toBe("20261101-match-nov-1-2026-v29cc184");
    expect(veoSlugOf("20260712-match-12-juill-2026-v8ee52ab")).toBe("20260712-match-12-juill-2026-v8ee52ab");
    expect(veoSlugOf("https://exemple.com/x")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { reviewEmail, shouldAskReview } from "@/lib/google-review";

describe("avis Google", () => {
  const url = "https://g.page/r/abc/review";
  it("seulement 9 ou 10, avec un lien, une seule fois", () => {
    expect(shouldAskReview(10, url, false)).toBe(true);
    expect(shouldAskReview(9, url, false)).toBe(true);
    expect(shouldAskReview(8, url, false)).toBe(false);
    expect(shouldAskReview(10, null, false)).toBe(false);
    expect(shouldAskReview(10, url, true)).toBe(false);
    expect(shouldAskReview(null, url, false)).toBe(false);
  });
  it("le courriel salue le parent et contient le lien", () => {
    const m = reviewEmail("Julie Thibeault", "Aliss Bouchard", url);
    expect(m.text).toContain("Bonjour Julie");
    expect(m.html).toContain(url);
    expect(m.text).toContain("avec Aliss");
  });
});

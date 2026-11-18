import { describe, expect, it } from "vitest";

import { parsePhotoUrl, photoPath } from "@/lib/player-photos";

describe("photos privées des joueuses", () => {
  it("comprend la nouvelle adresse et l'ancienne adresse publique", () => {
    expect(parsePhotoUrl(photoPath("athlete-photos", "abc-1.jpg"))).toEqual({ bucket: "athlete-photos", path: "abc-1.jpg" });
    expect(parsePhotoUrl("https://x.supabase.co/storage/v1/object/public/child-photos/u1/c1-2.png")).toEqual({ bucket: "child-photos", path: "u1/c1-2.png" });
  });
  it("refuse les autres dossiers et les chemins qui remontent", () => {
    expect(parsePhotoUrl("https://x.supabase.co/storage/v1/object/public/product-photos/a.jpg")).toBeNull();
    expect(parsePhotoUrl("/photos/athlete-photos/../documents/x.pdf")).toBeNull();
    expect(parsePhotoUrl(null)).toBeNull();
  });
});

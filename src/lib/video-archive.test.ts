import { describe, expect, it } from "vitest";

import { archiveLabel } from "@/lib/video-archive";

const base = { archive_status: "a-faire", archive_bytes: 0, archive_size: null, archive_error: null, veo_expired: false };

describe("copie de l'académie", () => {
  it("états lisibles pour JP", () => {
    expect(archiveLabel({ ...base, archive_status: "fait", archive_size: 3_080_000_000 })).toBe("Gardée par l'académie (3,1 Go)");
    expect(archiveLabel({ ...base, archive_status: "en-cours", archive_bytes: 1_232_000_000, archive_size: 3_080_000_000 })).toBe("Téléchargement : 40 % (1,2 Go sur 3,1 Go)");
    expect(archiveLabel(base)).toBe("Téléchargement à venir (chaque heure)");
    expect(archiveLabel({ ...base, veo_expired: true })).toBe("Effacée chez Veo avant d'être téléchargée");
    expect(archiveLabel({ ...base, archive_status: "erreur", archive_error: "x" })).toBe("Téléchargement bloqué : x");
  });
});

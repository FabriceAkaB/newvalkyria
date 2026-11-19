import { describe, expect, it } from "vitest";

import { checkIncident, incidentTaskTitle } from "@/lib/player-incidents";

describe("fiche de blessure", () => {
  it("demande la joueuse, le type et une description de 5 mots", () => {
    expect(checkIncident({ kind: "blessure", description: "Tombée sur le genou gauche au 2c2" })).toEqual({ ok: false, error: "Choisis la joueuse." });
    expect(checkIncident({ registrationId: "r1", kind: "x", description: "Tombée sur le genou gauche au 2c2" }).ok).toBe(false);
    expect(checkIncident({ registrationId: "r1", kind: "blessure", description: "Genou" }).ok).toBe(false);
    expect(checkIncident({ registrationId: "r1", kind: "blessure", description: "Tombée sur le genou gauche au 2c2" }).ok).toBe(true);
  });

  it("arrête toujours la joueuse après un choc à la tête", () => {
    const r = checkIncident({ registrationId: "r1", kind: "choc-tete", description: "Ballon reçu au visage pendant le rondo", stoppedPlaying: false });
    expect(r.ok && r.value.stoppedPlaying).toBe(true);
  });

  it("dit à JP d'appeler la famille tant que le parent n'est pas avisé", () => {
    expect(incidentTaskTitle({ kind: "choc-tete", playerName: "Léa B.", parentNotified: false })).toBe("Appeler la famille de Léa B. (choc à la tête à la pratique, parent pas encore avisé)");
    expect(incidentTaskTitle({ kind: "blessure", playerName: "Léa B.", parentNotified: true })).toBe("Prendre des nouvelles de Léa B. (blessure à la pratique)");
  });
});

import { describe, expect, it } from "vitest";

import { reportDoneEmail } from "@/lib/coach-report-notice";

describe("Courriel « rapports du jour complets »", () => {
  it("dit que c'est automatique et que l'heure est ajoutée à la banque d'heures", () => {
    const m = reportDoneEmail("Maéva", "2026-11-19");
    expect(m.subject).toBe("Vos rapports du jeudi 19 novembre sont complets");
    expect(m.text).toContain("courriel automatique");
    expect(m.text).toContain("banque d'heures");
    expect(m.html).toContain("Bonjour Maéva,");
  });
});

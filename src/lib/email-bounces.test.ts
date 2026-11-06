import { describe, expect, it } from "vitest";

import { parseBounce } from "@/lib/email-bounces";

describe("courriels refusés", () => {
  it("lit un rebond Gmail en français (Microsoft refuse : pas de DMARC)", () => {
    const t = "** Message bloqué **\nVotre message à maryse_amyot@hotmail.com a été bloqué. Pour en savoir plus, consultez les informations techniques ci-dessous.\nRéponse du serveur distant :\n550 5.7.1 Message rejected: Message lacks SPF/DKIM/DMARC Auth Records (AS9031519) [DM3PEPF000265B8.namprd04.prod.outlook.com]";
    const p = parseBounce(t, "Alexia : sa place pour la 2e partie de la saison");
    expect(p.recipient).toBe("maryse_amyot@hotmail.com");
    expect(p.kind).toBe("authentification");
    expect(p.reason).toMatch(/^550 5\.7\.1 Message rejected/);
    expect(p.subject).toBe("Alexia : sa place pour la 2e partie de la saison");
  });
  it("adresse qui n'existe pas", () => {
    const p = parseBounce("Address not found\nYour message wasn't delivered to jean@exmple.com because the address couldn't be found.\n550 5.1.1 The email account that you tried to reach does not exist.", null);
    expect(p.kind).toBe("adresse-inexistante");
    expect(p.recipient).toBe("jean@exmple.com");
  });
});

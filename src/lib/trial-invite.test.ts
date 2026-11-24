import { describe, expect, it } from "vitest";

import { inviteCopy, inviteUrl, isFreshWin, mailHref, parseRefCode, smsHref } from "@/lib/trial-invite";

describe("invite une amie à l'essai", () => {
  it("lit le code de parrainage de l'adresse, sinon rien", () => {
    expect(parseRefCode(" ab12cd ")).toBe("AB12CD");
    expect(parseRefCode("abc")).toBeNull();
    expect(parseRefCode("ab12<script>")).toBeNull();
    expect(parseRefCode(null)).toBeNull();
  });

  it("lien vers le formulaire d'essai avec le code", () => {
    expect(inviteUrl("https://www.newvalkyria.com/", "AB12CD")).toBe("https://www.newvalkyria.com/inscription/essai?ref=AB12CD");
  });

  it("une victoire compte 14 jours", () => {
    expect(isFreshWin("2026-12-01", "2026-12-15")).toBe(true);
    expect(isFreshWin("2026-12-01", "2026-12-16")).toBe(false);
    expect(isFreshWin("2026-12-20", "2026-12-15")).toBe(false);
    expect(isFreshWin(null, "2026-12-15")).toBe(false);
  });

  it("les mots changent selon le moment, avec le prénom", () => {
    expect(inviteCopy("championne", "Léa").title).toContain("Léa a été championne du jour");
    expect(inviteCopy("video", "Léa").title).toContain("progrès de Léa");
    expect(inviteCopy("bulletin", "").title).toContain("votre fille");
    const c = inviteCopy("bulletin", "Léa");
    expect(c.share).toContain("de Léa");
    expect(c.share).not.toMatch(/—/);
    expect(smsHref(c, "https://x.ca/e")).toMatch(/^sms:\?&body=/);
    expect(decodeURIComponent(mailHref(c, "https://x.ca/e"))).toContain("https://x.ca/e");
  });
});

import { describe, expect, it } from "vitest";

import { sameWaitlistPlayer, waitlistNote } from "@/lib/waitlist-watch";

describe("sameWaitlistPlayer", () => {
  const lelia = { firstName: "Lelia", lastName: "Beaudry", parentEmail: "parent@x.com" };
  it("reconnaît la même fille malgré les accents, majuscules et espaces", () => {
    expect(sameWaitlistPlayer({ firstName: " lélia ", lastName: "BEAUDRY", parentEmail: "autre@y.com" }, lelia)).toBe(true);
  });
  it("reconnaît un nom composé écrit en partie", () => {
    expect(sameWaitlistPlayer({ firstName: "Lelia", lastName: "Beaudry-Tremblay", parentEmail: null }, lelia)).toBe(true);
  });
  it("même prénom et même courriel parent : l'autre nom de famille a pu être écrit autrement", () => {
    expect(sameWaitlistPlayer({ firstName: "Lelia", lastName: "Simb", parentEmail: "PARENT@x.com" }, lelia)).toBe(true);
  });
  it("une sœur (même courriel, autre prénom) n'est pas la même fille", () => {
    expect(sameWaitlistPlayer({ firstName: "Maya", lastName: "Beaudry", parentEmail: "parent@x.com" }, lelia)).toBe(false);
  });
  it("même prénom, autre famille : non", () => {
    expect(sameWaitlistPlayer({ firstName: "Lelia", lastName: "Martin", parentEmail: "m@z.com" }, lelia)).toBe(false);
  });
});

describe("waitlistNote", () => {
  it("rien quand elle n'était pas sur une liste d'attente", () => {
    expect(waitlistNote([])).toBeNull();
  });
  it("nomme le programme et la date", () => {
    expect(waitlistNote([{ id: "1", table: "registrations", program: "NV 2015", since: "2026-11-08" }])).toContain("NV 2015 (depuis le 8 novembre)");
  });
});

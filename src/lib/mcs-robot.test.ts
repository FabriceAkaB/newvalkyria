import { describe, expect, it } from "vitest";

import { buildPostForm, cancelledTitle, CREATE_EVENT_SKIPPED, csrfOf, formFields, isLoginPage, parseAssignIds, parseOpponents, parsePresences, parseRoster } from "@/lib/mcs-robot";

// Pages MonClubSportif réduites à l'essentiel (structure relevée le 5 nov. 2026, noms inventés).
const cell = (event: number, state: string) =>
  `<td class="presence"><div class="hide"><span class="status unknown"></span><span class="status present"></span></div><div class="manager"><div class="availability-wrapper"><form class="presence-form" action="/team/1/seasons/2/presences/set"><input type="hidden" name="authenticity_token" value="tok"><input type="hidden" name="event_id" value="${event}"><input type="hidden" name="member_id" value="9"></form><span class="status ${state} no-past"></span></div></div></td>`;
const PRESENCES = `<table><thead><tr><th>Membre</th><th class="presence center">Pratique <br> Lun 9 nov. 2026</th><th class="presence center">Match <br> Sam 14 nov. 2026</th></tr></thead><tbody>
<tr><td class="member"><a class="rosters-details-link" href="/team/1/seasons/2/roster/101">Alice Test</a></td>${cell(501, "unknown")}${cell(502, "present")}</tr>
<tr><td class="member"><a class="rosters-details-link" href="/team/1/seasons/2/roster/102">Béa Exemple</a></td>${cell(501, "absent")}${cell(502, "unknown")}</tr>
</tbody></table>`;

describe("robot MonClubSportif : lecture des pages", () => {
  it("lit le jeton de sécurité et reconnaît la page de connexion", () => {
    expect(csrfOf('<form><input type="hidden" name="authenticity_token" value="abc"></form>')).toBe("abc");
    expect(csrfOf('<meta name="csrf-token" content="xyz">')).toBe("xyz");
    expect(isLoginPage('<input name="user_session[password]">')).toBe(true);
    expect(isLoginPage("<h1>Mes groupes</h1>")).toBe(false);
  });

  it("lit la liste des membres d'une équipe sans les liens d'action", () => {
    const html = `<a href="/team/1/seasons/2/roster/101">Alice Test</a><a href="/team/1/seasons/2/roster/101/modify">Modifier</a><a href="/team/1/seasons/2/roster/102">Béa  Exemple</a><a href="/team/9/seasons/2/roster/103">Autre équipe</a>`;
    expect(parseRoster(html, 1, 2)).toEqual([{ id: 101, name: "Alice Test" }, { id: 102, name: "Béa Exemple" }]);
  });

  it("lit qui n'a pas encore répondu pour chaque événement", () => {
    const g = parsePresences(PRESENCES);
    expect(g.events.map((e) => e.id)).toEqual([501, 502]);
    expect(g.events[1].title).toContain("Match");
    expect(g.rows).toEqual([
      { memberId: 101, name: "Alice Test", states: { 501: "unknown", 502: "present" } },
      { memberId: 102, name: "Béa Exemple", states: { 501: "absent", 502: "unknown" } }
    ]);
  });

  it("lit les événements à assigner, les adversaires connus et les champs d'un formulaire", () => {
    expect(parseAssignIds('<input type="checkbox" name="assign[]" value="7" checked><input type="checkbox" name="assign[]" value="8">')).toEqual(["7", "8"]);
    const game = `<form action="/team/1/seasons/2/calendar/games/5"><input type="hidden" name="_method" value="patch"><select name="game[opponent_id]"><option value="">Choisir</option><option value="11">À déterminer</option><option value="12" selected>FC Test</option><option value="new">Nouveau…</option></select><input type="checkbox" name="send_by_email" value="on"><input type="radio" name="game[home]" value="1" checked><input type="radio" name="game[home]" value="0"><textarea name="game[comments]">Bonne chance</textarea><input type="file" name="game[file]"></form>`;
    expect([...parseOpponents(game)]).toEqual([["À déterminer", "11"], ["FC Test", "12"]]);
    expect(formFields(game, "/games/5")).toEqual([["_method", "patch"], ["game[opponent_id]", "12"], ["game[home]", "1"], ["game[comments]", "Bonne chance"]]);
  });
});

describe("assignations de la direction", () => {
  it("lit les activités où le membre n'est pas assigné", async () => {
    const { parseMemberAssignments, parseAssignmentEvents } = await import("@/lib/mcs-robot");
    const html = `<form><input type="checkbox" name="assign[]" value="11" checked><input type="checkbox" name="assign[]" value="12"></form>`;
    expect(parseMemberAssignments(html)).toEqual({ total: 2, missing: ["12"] });
    expect(parseAssignmentEvents(`<input name="events[]" value="5"><input name="events[]" value="6">`)).toEqual(["5", "6"]);
  });
});

describe("remplaçantes jamais assignées par le robot", () => {
  it("une nouvelle activité n'invite ni les remplaçantes ni « inclure les remplaçants », même si MCS les cochait", () => {
    const html = `<form action="/team/1/seasons/2/calendar/events"><input type="checkbox" name="assign[]" value="11" checked><input type="checkbox" name="include_reserve" checked><input type="checkbox" class="reserve-checkbox" name="invite[]" value="77" checked><input type="checkbox" class="reserve-checkbox" name="invite[]" value="78"></form>`;
    const sent = formFields(html, "/calendar/events").filter(([k]) => !CREATE_EVENT_SKIPPED.includes(k));
    expect(sent).toEqual([["assign[]", "11"]]);
  });
});

describe("publications et annulations", () => {
  it("publication privée : un membre par case, avis courriel par défaut", () => {
    expect(buildPostForm("tok", { subject: "Sondage", html: "<p>Lien</p>", to: [12, 34] })).toEqual([
      ["authenticity_token", "tok"],
      ["recipients[]", "12"],
      ["recipients[]", "34"],
      ["post[subject]", "Sondage"],
      ["post[body]", "<p>Lien</p>"],
      ["send_by_email", "1"]
    ]);
  });
  it("toute l'équipe, épinglée, sans avis ; refus sans destinataire", () => {
    const f = buildPostForm("tok", { subject: "Annulée", html: "<p>x</p>", to: "all", sticky: true, notify: false });
    expect(f).toContainEqual(["recipients[]", "all"]);
    expect(f).toContainEqual(["post[sticky]", "1"]);
    expect(f.some(([k]) => k === "send_by_email")).toBe(false);
    expect(() => buildPostForm("tok", { subject: "x", html: "<p>x</p>", to: [] })).toThrow();
  });
  it("titre annulé jamais doublé", () => {
    expect(cancelledTitle("Pratique semi privée")).toBe("ANNULÉE : Pratique semi privée");
    expect(cancelledTitle("ANNULÉE : Pratique semi privée")).toBe("ANNULÉE : Pratique semi privée");
  });
});

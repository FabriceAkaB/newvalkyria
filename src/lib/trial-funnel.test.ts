import { describe, expect, it } from "vitest";

import { buildFunnel, funnelRow, type FunnelLog, type FunnelTrial } from "@/lib/trial-funnel";

const trial = (over: Partial<FunnelTrial> = {}): FunnelTrial => ({
  ref: "registrations:a1",
  table: "registrations",
  id: "a1",
  program: "Essai filles",
  playerName: "Léa Tremblay",
  parentName: "Julie Tremblay",
  parentEmail: "julie@exemple.ca",
  parentPhone: "514 555-0101",
  createdAt: "2026-12-01T15:00:00.000Z",
  trialDate: null,
  cancelled: false,
  converted: false,
  source: "reseaux",
  ...over
});
const log = (step: string | null, at: string, over: Partial<FunnelLog> = {}): FunnelLog => ({
  trialRef: "registrations:a1",
  step,
  kind: step === "liste-chaude" ? "plus-tard" : step === "refus" ? "refus" : "relance",
  at,
  parentEmail: "julie@exemple.ca",
  playerName: "Léa Tremblay",
  notes: null,
  ...over
});
const at = (iso: string) => new Date(iso);

describe("funnelRow", () => {
  it("une demande sans contact est à appeler, en retard après 24 h", () => {
    const fresh = funnelRow(trial(), [], at("2026-12-01T20:00:00.000Z"));
    expect(fresh.stage).toBe("demande");
    expect(fresh.next).toMatchObject({ step: "contact", dueNow: false, late: false });
    expect(fresh.contactedIn24h).toBeNull();
    const late = funnelRow(trial(), [], at("2026-12-02T16:00:00.000Z"));
    expect(late.next).toMatchObject({ step: "contact", dueNow: true, late: true });
    expect(late.contactedIn24h).toBe(false);
  });

  it("contactée sans date : à planifier ; contact dans les 24 h mesuré", () => {
    const r = funnelRow(trial(), [log("contact", "2026-12-01T22:00:00.000Z")], at("2026-12-02T14:00:00.000Z"));
    expect(r.stage).toBe("a-planifier");
    expect(r.contactedIn24h).toBe(true);
    expect(r.next?.step).toBe("planifier");
  });

  it("un échange noté ailleurs dans les relances après la demande vaut premier contact", () => {
    const other = log(null, "2026-12-01T18:00:00.000Z", { trialRef: null, kind: "reponse", playerName: null });
    expect(funnelRow(trial(), [other], at("2026-12-03T12:00:00Z")).stage).toBe("a-planifier");
    const before = log(null, "2026-11-20T18:00:00.000Z", { trialRef: null });
    expect(funnelRow(trial(), [before], at("2026-12-03T12:00:00Z")).stage).toBe("demande");
    const sister = log(null, "2026-12-01T18:00:00.000Z", { trialRef: null, playerName: "Emma Tremblay" });
    expect(funnelRow(trial(), [sister], at("2026-12-03T12:00:00Z")).stage).toBe("demande");
  });

  it("essai réservé : rappel dû la veille seulement", () => {
    const t = trial({ trialDate: "2026-12-06" });
    const logs = [log("contact", "2026-12-01T22:00:00.000Z")];
    const early = funnelRow(t, logs, at("2026-12-03T15:00:00Z"));
    expect(early.stage).toBe("reserve");
    expect(early.next).toMatchObject({ step: "rappel", due: "2026-12-05", dueNow: false });
    expect(funnelRow(t, logs, at("2026-12-05T15:00:00Z")).next?.dueNow).toBe(true);
    expect(funnelRow(t, [...logs, log("rappel", "2026-12-05T15:00:00Z")], at("2026-12-05T18:00:00Z")).next).toBeNull();
  });

  it("essai fait : offre le lendemain, puis relances 3, 7, 14 et liste chaude", () => {
    const t = trial({ trialDate: "2026-12-06" });
    const logs = [log("contact", "2026-12-01T22:00:00.000Z")];
    const done = funnelRow(t, logs, at("2026-12-07T15:00:00Z"));
    expect(done.stage).toBe("fait");
    expect(done.next).toMatchObject({ step: "offre", due: "2026-12-07", dueNow: true, late: false });
    const offered = [...logs, log("offre", "2026-12-07T16:00:00Z")];
    const r3 = funnelRow(t, offered, at("2026-12-09T15:00:00Z"));
    expect(r3.stage).toBe("offre");
    expect(r3.next).toMatchObject({ step: "relance-3", due: "2026-12-10", dueNow: false });
    const all = [...offered, log("relance-3", "2026-12-10T15:00:00Z"), log("relance-7", "2026-12-14T15:00:00Z")];
    expect(funnelRow(t, all, at("2026-12-22T15:00:00Z")).next).toMatchObject({ step: "relance-14", due: "2026-12-21", late: true });
    expect(funnelRow(t, [...all, log("relance-14", "2026-12-22T15:00:00Z")], at("2026-12-23T15:00:00Z")).stage).toBe("liste-chaude");
  });

  it("résultats : inscrite, annulée, refus, liste chaude, absente puis nouvelle date", () => {
    const now = at("2026-12-10T15:00:00Z");
    expect(funnelRow(trial({ converted: true }), [], now).stage).toBe("inscrite");
    expect(funnelRow(trial({ cancelled: true }), [], now).stage).toBe("perdue");
    expect(funnelRow(trial(), [log("refus", "2026-12-02T15:00:00Z")], now).stage).toBe("perdue");
    expect(funnelRow(trial(), [log("liste-chaude", "2026-12-02T15:00:00Z")], now).stage).toBe("liste-chaude");
    const absent = [log("contact", "2026-12-01T22:00:00Z"), log("absente", "2026-12-06T20:00:00Z")];
    expect(funnelRow(trial({ trialDate: "2026-12-06" }), absent, now).stage).toBe("absente");
    expect(funnelRow(trial({ trialDate: "2026-12-13" }), absent, now).stage).toBe("reserve");
  });
});

describe("buildFunnel", () => {
  it("à faire aujourd'hui : les demandes sans contact d'abord, comptes par étape, contact en 24 h", () => {
    const now = at("2026-12-08T15:00:00Z");
    const a = trial({ ref: "registrations:a", id: "a", trialDate: "2026-12-06" });
    const b = trial({ ref: "registrations:b", id: "b", parentEmail: "b@x.ca", playerName: "B", createdAt: "2026-12-06T15:00:00.000Z" });
    const c = trial({ ref: "registrations:c", id: "c", parentEmail: "c@x.ca", playerName: "C", trialDate: "2026-12-20" });
    const logs = [log("contact", "2026-12-01T20:00:00Z", { trialRef: "registrations:a" }), log("contact", "2026-12-03T20:00:00Z", { trialRef: "registrations:c", parentEmail: "c@x.ca" })];
    const board = buildFunnel([a, b, c], logs, now, "2026-11-01");
    expect(board.today.map((r) => r.id)).toEqual(["b", "a"]);
    expect(board.counts).toMatchObject({ demande: 1, fait: 1, reserve: 1 });
    expect(board.contact24h).toEqual({ within: 1, total: 3 });
  });

  it("une demande d'avant le tableau, jamais suivie, n'est plus réclamée ; ses résultats restent", () => {
    const now = at("2026-12-08T15:00:00Z");
    const old = trial({ ref: "registrations:o", id: "o", createdAt: "2026-08-24T15:00:00.000Z" });
    const oldFuture = trial({ ref: "registrations:f", id: "f", createdAt: "2026-11-20T15:00:00.000Z", trialDate: "2026-12-10" });
    const oldDone = trial({ ref: "registrations:d", id: "d", createdAt: "2026-10-01T15:00:00.000Z", converted: true });
    const board = buildFunnel([old, oldFuture, oldDone], [], now, "2026-11-24");
    expect(board.rows.map((r) => r.id).sort()).toEqual(["d", "f"]);
    expect(board.contact24h.total).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { dequeue, enqueue, parseQueue, sendOutcome } from "@/lib/kiosk-queue";

const a = (registrationId: string, at: number, practiceRating = 8) => ({ registrationId, at, answers: { practiceRating } });

describe("borne hors ligne", () => {
  it("une seule réponse par fille : la dernière remplace la précédente", () => {
    const q = enqueue(enqueue(enqueue([], a("x", 1)), a("y", 2)), a("x", 3, 10));
    expect(q.map((i) => `${i.registrationId}:${i.answers.practiceRating}`)).toEqual(["y:8", "x:10"]);
  });

  it("une réponse envoyée sort de la file, sauf si la fille a répondu de nouveau pendant l'envoi", () => {
    const sent = a("x", 1);
    expect(dequeue([sent, a("y", 2)], sent).map((i) => i.registrationId)).toEqual(["y"]);
    expect(dequeue([a("x", 5)], sent)).toHaveLength(1);
  });

  it("stockage vide ou abîmé : file vide", () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue("{pas du json")).toEqual([]);
    expect(parseQueue(JSON.stringify([a("x", 1), { foo: 1 }]))).toHaveLength(1);
  });

  it("sans réseau ou serveur indisponible : on réessaie ; refus du serveur : on n'insiste pas", () => {
    expect([null, 0, 500, 503, 408, 429].map(sendOutcome)).toEqual(Array(6).fill("retry"));
    expect(sendOutcome(200)).toBe("sent");
    expect([400, 403, 404].map(sendOutcome)).toEqual(["rejected", "rejected", "rejected"]);
  });
});

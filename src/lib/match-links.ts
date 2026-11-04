import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/** Liens à copier depuis l'admin pour un match (demande de JP) :
 *  - paiement direct : la plage est déjà choisie pour le club qui veut payer, même hors de sa catégorie d'âge
 *    (la clé signée vaut approbation de l'académie, pour cette plage et sa double cédule seulement) ;
 *  - adversaire : la page de son match réservé (date, lieu, format, ce qui a été payé) ;
 *  - arbitres : la page du match pour les arbitres (rémunération, inscription, lien personnel). */

const secret = () => process.env.MATCH_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "nv-match-links";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSlotId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

export function slotPass(slotId: string): string {
  return createHmac("sha256", secret()).update(`match-slot:${slotId.toLowerCase()}`).digest("base64url").slice(0, 22);
}

export function checkSlotPass(slotId: unknown, pass: unknown): boolean {
  if (!isSlotId(slotId) || typeof pass !== "string" || pass.length !== 22) return false;
  const a = Buffer.from(slotPass(slotId));
  const b = Buffer.from(pass);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function matchLinks(slotId: string, bookingIds: string[] = []) {
  const base = env.publicSiteUrl;
  return {
    pay: `${base}/prive/matchs?plage=${slotId}&cle=${slotPass(slotId)}`,
    opponent: bookingIds.length ? `${base}/prive/matchs/confirmation?ids=${bookingIds.slice(0, 2).join(",")}` : null,
    referee: `${base}/arbitres/match/${slotId}`
  };
}

export type MatchLinks = ReturnType<typeof matchLinks>;

/** Les liens de chaque plage pour l'admin ; le lien adversaire couvre ses 2 matchs d'une double cédule. */
export function slotLinks(
  slots: { id: string; double_group: string | null }[],
  bookings: { id: string; slot_id: string; org_key: string; status: string; slot?: { double_group: string | null } | null }[]
): Record<string, MatchLinks> {
  const out: Record<string, MatchLinks> = {};
  for (const s of slots) {
    const live = bookings.filter((b) => b.status !== "cancelled");
    const own = live.find((b) => b.slot_id === s.id);
    const ids = own ? live.filter((b) => b.org_key === own.org_key && (b.slot_id === s.id || (s.double_group && b.slot?.double_group === s.double_group))).map((b) => b.id) : [];
    out[s.id] = matchLinks(s.id, ids);
  }
  return out;
}

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/** Borne de sondage (iPad au bord du terrain) : un lien par pratique, signé, sans connexion. Celui qui a le lien
 *  voit les prénoms et les photos des joueuses de cette pratique seulement, et peut y répondre au sondage. */

const secret = () => process.env.MATCH_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "nv-borne";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function kioskKey(activityId: string): string {
  return createHmac("sha256", secret()).update(`borne:${activityId.toLowerCase()}`).digest("base64url").slice(0, 22);
}

export function checkKioskKey(activityId: unknown, key: unknown): boolean {
  if (typeof activityId !== "string" || !UUID.test(activityId) || typeof key !== "string" || key.length !== 22) return false;
  const a = Buffer.from(kioskKey(activityId));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const kioskUrl = (activityId: string, base = env.publicSiteUrl) => `${base}/borne/${activityId}?cle=${kioskKey(activityId)}`;
export const kioskPath = (activityId: string) => `/borne/${activityId}?cle=${kioskKey(activityId)}`;

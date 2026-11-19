import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/** Paiement d'un versement refusé par la famille elle-même (JP, 18 nov. 2026) : un lien personnel signé
 *  (pas de connexion) ouvre la page du versement ; la famille paie avec une autre carte, qui devient la carte
 *  des versements suivants. */

export const INSTALLMENT_SOURCES = ["season", "sessionprogram", "sportetudes"] as const;
export type InstallmentSource = (typeof INSTALLMENT_SOURCES)[number];
export const isInstallmentSource = (s: unknown): s is InstallmentSource => typeof s === "string" && (INSTALLMENT_SOURCES as readonly string[]).includes(s);

const secret = () => process.env.MATCH_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "nv-versement";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function installmentPayKey(source: InstallmentSource, id: string): string {
  return createHmac("sha256", secret()).update(`versement:${source}:${id.toLowerCase()}`).digest("base64url").slice(0, 22);
}

export function checkInstallmentPayKey(source: unknown, id: unknown, key: unknown): boolean {
  if (!isInstallmentSource(source) || typeof id !== "string" || !UUID.test(id) || typeof key !== "string" || key.length !== 22) return false;
  const a = Buffer.from(installmentPayKey(source, id));
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const installmentPayPath = (source: InstallmentSource, id: string) => `/paiement/versement/${source}/${id}?cle=${installmentPayKey(source, id)}`;
export const installmentPayUrl = (source: InstallmentSource, id: string) => `${env.publicSiteUrl}${installmentPayPath(source, id)}`;

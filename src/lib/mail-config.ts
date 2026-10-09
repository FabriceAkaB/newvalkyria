import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface MailConfig {
  user: string;
  password: string;
  fromName: string;
  source: "env" | "db";
}

function key(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant : impossible de chiffrer la boîte d'envoi.");
  return createHash("sha256").update(`nv-email-settings:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

let cache: { at: number; value: MailConfig | null } | null = null;

/** Boîte d'envoi : variables d'environnement d'abord, sinon réglage enregistré
 *  (chiffré) dans la base — modifiable depuis l'admin sans toucher à Vercel. */
export async function getMailConfig(): Promise<MailConfig | null> {
  const envUser = process.env.GMAIL_SMTP_USER;
  const envPass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (envUser && envPass) {
    return { user: envUser, password: envPass.replace(/\s+/g, ""), fromName: process.env.GMAIL_SMTP_FROM_NAME ?? "New Valkyria", source: "env" };
  }

  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  try {
    const { data } = await (getSupabaseAdminClient() as any).from("email_settings").select("*").eq("id", true).maybeSingle();
    const value: MailConfig | null = data ? { user: data.smtp_user, password: decryptSecret(data.smtp_password_enc), fromName: data.from_name || "New Valkyria", source: "db" } : null;
    cache = { at: Date.now(), value };
    return value;
  } catch {
    cache = { at: Date.now(), value: null };
    return null;
  }
}

export function clearMailConfigCache() {
  cache = null;
}

export async function saveMailConfig(input: { user: string; password: string; fromName?: string }): Promise<void> {
  const user = input.user.trim().toLowerCase();
  const password = input.password.replace(/\s+/g, "");
  if (!user.includes("@")) throw new Error("Adresse courriel invalide.");
  if (password.length < 8) throw new Error("Mot de passe d'application invalide.");
  const { error } = await (getSupabaseAdminClient() as any).from("email_settings").upsert({
    id: true,
    smtp_user: user,
    smtp_password_enc: encryptSecret(password),
    from_name: input.fromName?.trim() || "New Valkyria",
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(error.message);
  clearMailConfigCache();
}

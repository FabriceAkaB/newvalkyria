import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** Hachage scrypt (sel aléatoire par mot de passe) — pour les comptes
 *  entraîneur, potentiellement nombreux, contrairement au mot de passe
 *  admin unique stocké en variable d'environnement. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedBuffer = scryptSync(password, salt, 64);
  if (hashBuffer.length !== derivedBuffer.length) return false;
  return timingSafeEqual(hashBuffer, derivedBuffer);
}

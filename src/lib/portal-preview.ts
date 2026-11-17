import { randomBytes } from "node:crypto";

import { logAudit } from "@/lib/audit-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Aperçu des portails (JP, 17 nov. 2026) : l'admin ouvre le portail d'un éducateur ou d'une famille exactement comme
 *  cette personne le voit à sa connexion. Session courte (2 h), notée au journal d'audit. Ce qu'on y fait compte comme
 *  si cette personne l'avait fait : regarder, pas agir. */

export const PREVIEW_TTL_SECONDS = 2 * 60 * 60;

function db() {
  return getSupabaseAdminClient() as any;
}

export async function createPreviewSession(kind: "coach" | "famille", id: string, label: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires_at = new Date(Date.now() + PREVIEW_TTL_SECONDS * 1000).toISOString();
  const { error } = kind === "coach"
    ? await db().from("coach_sessions").insert({ token, coach_id: id, expires_at })
    : await db().from("parent_sessions").insert({ token, user_id: id, expires_at });
  if (error) throw new Error(error.message);
  await logAudit({ actorRole: "admin", actorLabel: "JP (aperçu)", action: "portal_preview", entityType: kind === "coach" ? "coaches" : "parent_account", entityId: id, entityLabel: `Aperçu du portail ${kind === "coach" ? "éducateur" : "famille"} : ${label}` }).catch(() => null);
  return token;
}

/** Les familles qui ont un compte (courriel du compte = parent d'une inscription payée), avec leurs filles. */
export async function listFamilyAccounts(): Promise<{ userId: string; email: string; name: string; children: string[]; lastSignIn: string | null }[]> {
  const { data: regs } = await db().from("registrations").select("parent_email, player_first_name").eq("status", "paid");
  const kids = new Map<string, Set<string>>();
  for (const r of (regs ?? []) as any[]) {
    const e = String(r.parent_email ?? "").trim().toLowerCase();
    if (!e) continue;
    if (!kids.has(e)) kids.set(e, new Set());
    kids.get(e)!.add(String(r.player_first_name ?? "").trim());
  }
  const out: { userId: string; email: string; name: string; children: string[]; lastSignIn: string | null }[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await (db() as any).auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    for (const u of data?.users ?? []) {
      const e = String(u.email ?? "").toLowerCase();
      if (!kids.has(e)) continue;
      out.push({ userId: u.id, email: u.email, name: (u.user_metadata?.full_name as string) || u.email, children: [...kids.get(e)!], lastSignIn: u.last_sign_in_at ?? null });
    }
    if ((data?.users ?? []).length < 200) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

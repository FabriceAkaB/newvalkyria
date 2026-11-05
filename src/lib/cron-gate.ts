import { NextResponse } from "next/server";

import { isAdminRequest, type AdminRole } from "@/lib/admin-auth";
import { backupShouldSkip, type CronName } from "@/lib/cron-jobs";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

let backupSecret: { value: string | null; at: number } | null = null;

/** Secret du déclencheur de secours (Supabase pg_cron), gardé en base dans une table que seul le service role lit. */
async function getBackupSecret(): Promise<string | null> {
  if (backupSecret && Date.now() - backupSecret.at < 10 * 60_000) return backupSecret.value;
  const { data } = await db().from("cron_backup_config").select("secret").eq("id", 1).maybeSingle();
  backupSecret = { value: (data?.secret as string | undefined) ?? null, at: Date.now() };
  return backupSecret.value;
}

export async function recordCronRun(name: CronName, source: string, ok: boolean, detail?: string): Promise<void> {
  await db().from("cron_runs").insert({ name, source, ok, detail: detail ?? null }).then(() => null, () => null);
}

async function lastOkRun(name: CronName): Promise<string | null> {
  const { data } = await db().from("cron_runs").select("ran_at").eq("name", name).eq("ok", true).order("ran_at", { ascending: false }).limit(1);
  return (data?.[0]?.ran_at as string | undefined) ?? null;
}

/** Porte d'entrée de toutes les tâches automatiques : Vercel (CRON_SECRET), secours Supabase (secret en base ;
 *  ne refait rien si la tâche a déjà roulé) ou admin connecté. Chaque passage laisse une trace dans `cron_runs`,
 *  y compris un appel de Vercel refusé (pour savoir tout de suite si CRON_SECRET manque dans Vercel). */
export async function cronGate(request: Request, name: CronName, opts: { adminRoles?: AdminRole[] } = {}): Promise<{ ok: true; source: string } | { ok: false; response: NextResponse }> {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (bearer && env.cronSecret && bearer === env.cronSecret) {
    await recordCronRun(name, "vercel", true);
    return { ok: true, source: "vercel" };
  }
  const backup = bearer ? await getBackupSecret() : null;
  if (bearer && backup && bearer === backup) {
    if (backupShouldSkip(name, await lastOkRun(name), new Date())) {
      return { ok: false, response: NextResponse.json({ ok: true, skipped: "Déjà roulé dans sa fenêtre : le secours ne refait rien." }) };
    }
    await recordCronRun(name, "secours", true);
    return { ok: true, source: "secours" };
  }
  if (await isAdminRequest(opts.adminRoles ? { roles: opts.adminRoles } : undefined)) {
    await recordCronRun(name, "admin", true);
    return { ok: true, source: "admin" };
  }
  if (/vercel-cron/i.test(request.headers.get("user-agent") ?? "")) await recordCronRun(name, "vercel", false, bearer ? "secret différent" : "aucun secret envoyé");
  return { ok: false, response: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
}

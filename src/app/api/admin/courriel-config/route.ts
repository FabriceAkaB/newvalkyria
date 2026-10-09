import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getMailConfig, saveMailConfig } from "@/lib/mail-config";

/** Boîte d'envoi du site : lecture (jamais le mot de passe) et enregistrement chiffré. */
export async function GET() {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  const cfg = await getMailConfig();
  return NextResponse.json({ configured: Boolean(cfg), user: cfg?.user ?? null, fromName: cfg?.fromName ?? null, source: cfg?.source ?? null });
}

export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { user?: string; password?: string; fromName?: string } | null;
  if (!body?.user || !body.password) return jsonError("Adresse et mot de passe d'application requis.", 400);
  try {
    await saveMailConfig({ user: body.user, password: body.password, fromName: body.fromName });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

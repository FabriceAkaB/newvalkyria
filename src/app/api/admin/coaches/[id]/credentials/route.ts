import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { setCoachCredentials } from "@/lib/coach-auth";
import { jsonError } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = body?.username?.trim();
  const password = body?.password ?? "";

  if (!username || username.length < 3) return jsonError("Nom d'utilisateur invalide (3 caractères minimum)", 400);
  if (password.length < 6) return jsonError("Mot de passe invalide (6 caractères minimum)", 400);

  try {
    await setCoachCredentials(id, username, password);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur";
    if (message.includes("duplicate") || message.includes("unique")) return jsonError("Ce nom d'utilisateur est déjà pris", 409);
    return jsonError(message, 500);
  }

  return NextResponse.json({ ok: true });
}

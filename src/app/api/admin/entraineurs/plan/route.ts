import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Plan de développement d'un éducateur, écrit par JP ; l'éducateur le lit dans « Mon dossier ». */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { coachId?: string; plan?: string } | null;
  if (typeof b?.coachId !== "string" || typeof b.plan !== "string") return jsonError("Paramètres invalides", 400);
  const { error } = await (getSupabaseAdminClient() as any).from("coaches").update({ development_plan: b.plan.trim().slice(0, 3000) || null, updated_at: new Date().toISOString() }).eq("id", b.coachId);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}

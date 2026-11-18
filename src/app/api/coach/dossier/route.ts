import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { jsonError } from "@/lib/http";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Mon dossier : l'éducateur écrit ses objectifs professionnels. */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { goals?: string } | null;
  if (typeof b?.goals !== "string") return jsonError("Paramètres invalides", 400);
  const goals = b.goals.trim().slice(0, 2000) || null;
  const { error } = await (getSupabaseAdminClient() as any).from("coaches").update({ pro_goals: goals, updated_at: new Date().toISOString() }).eq("id", coachId);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}

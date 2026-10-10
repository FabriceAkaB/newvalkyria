import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getAllTrials } from "@/lib/boys-trials-repo";
import { jsonError } from "@/lib/http";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  return NextResponse.json({ trials: await getAllTrials() });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { id?: string; status?: "cancelled" | "attended" | "absent" | "confirmed"; capacity?: number; slug?: string } | null;
  if (body?.slug && typeof body.capacity === "number") {
    await (getSupabaseAdminClient() as any).from("session_programs").update({ trial_capacity: Math.max(0, Math.round(body.capacity)) }).eq("slug", body.slug);
    return NextResponse.json({ ok: true });
  }
  if (!body?.id || !body.status || !["cancelled", "attended", "absent", "confirmed"].includes(body.status)) return jsonError("Paramètres invalides", 400);
  const { error } = await (getSupabaseAdminClient() as any).from("boys_trials").update({ status: body.status }).eq("id", body.id);
  if (error) return jsonError(error.message, 422);
  return NextResponse.json({ ok: true });
}

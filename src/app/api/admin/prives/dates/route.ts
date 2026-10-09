import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

/** Calendrier configurable d'un programme privé (séances et matchs). */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { slug?: string; sessionDate?: string; startTime?: string; endTime?: string; location?: string } | null;
  if (!body?.slug || !body.sessionDate || !body.startTime || !body.endTime || !body.location?.trim()) return jsonError("Date, heures et lieu requis.", 400);
  const { count } = await db().from("session_program_dates").select("id", { count: "exact", head: true }).eq("program_slug", body.slug);
  const { error } = await db().from("session_program_dates").insert({
    program_slug: body.slug,
    session_date: body.sessionDate,
    start_time: body.startTime,
    end_time: body.endTime,
    location: body.location.trim(),
    display_order: (count ?? 0) + 1
  });
  if (error) return jsonError(error.message, 422);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("id requis", 400);
  const { error } = await db().from("session_program_dates").delete().eq("id", id);
  if (error) return jsonError(error.message, 422);
  return NextResponse.json({ ok: true });
}

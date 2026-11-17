import { NextResponse } from "next/server";

import { sessionCookie } from "@/lib/login-guard";

import { isAdminRequest } from "@/lib/admin-auth";
import { COACH_COOKIE_NAME } from "@/lib/coach-auth";
import { jsonError } from "@/lib/http";
import { createPreviewSession, PREVIEW_TTL_SECONDS } from "@/lib/portal-preview";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Ouvre le portail d'un éducateur tel qu'il le voit (aperçu de 2 h, admin seulement). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const { data: coach } = await (getSupabaseAdminClient() as any).from("coaches").select("id, first_name, last_name").eq("id", id).maybeSingle();
  if (!coach) return jsonError("Éducateur introuvable", 404);
  const token = await createPreviewSession("coach", id, `${coach.first_name} ${coach.last_name}`);
  const response = NextResponse.redirect(new URL("/entraineur/dashboard", request.url));
  response.cookies.set(COACH_COOKIE_NAME, token, sessionCookie(PREVIEW_TTL_SECONDS));
  return response;
}

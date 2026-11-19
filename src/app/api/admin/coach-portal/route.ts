import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { CLUB_ID } from "@/lib/club";
import { COACH_COOKIE_NAME, COACH_SESSION_TTL_SECONDS, createCoachSession } from "@/lib/coach-auth";
import { sessionCookie } from "@/lib/login-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** JP remplit son rapport de coach depuis l'admin (JP, 18 nov. 2026) : ouvre l'espace coach sous SON profil
 *  d'éducateur (app_settings « coach_admin_id »), sur la pratique demandée. Réservé au rôle admin. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!(await isAdminRequest({ roles: ["admin"] }))) return NextResponse.redirect(new URL("/admin", url));
  const { data } = await (getSupabaseAdminClient() as any).from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", "coach_admin_id").maybeSingle();
  const coachId = typeof data?.value === "string" ? data.value : null;
  if (!coachId) return NextResponse.redirect(new URL("/admin/entraineurs", url));
  const token = await createCoachSession(coachId);
  const activity = url.searchParams.get("activite");
  const target = activity && /^[0-9a-f-]{36}$/i.test(activity) ? `/entraineur/activites/${activity}` : "/entraineur";
  const res = NextResponse.redirect(new URL(target, url));
  res.cookies.set(COACH_COOKIE_NAME, token, sessionCookie(COACH_SESSION_TTL_SECONDS));
  return res;
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getAdminCoachId } from "@/lib/admin-my-practices";
import { COACH_COOKIE_NAME, COACH_SESSION_TTL_SECONDS, createCoachSession } from "@/lib/coach-auth";
import { sessionCookie } from "@/lib/login-guard";

/** JP remplit son rapport de coach depuis l'admin (JP, 18 nov. 2026) : ouvre l'espace coach sous SON profil
 *  d'éducateur (app_settings « coach_admin_id »), sur la pratique demandée. Réservé au rôle admin.
 *  `vue=tout-en-un` (JP, 25 nov. 2026) : la pratique, l'évaluation des filles et le rapport sur un seul écran. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!(await isAdminRequest({ roles: ["admin"] }))) return NextResponse.redirect(new URL("/admin", url));
  const coachId = await getAdminCoachId();
  if (!coachId) return NextResponse.redirect(new URL("/admin/entraineurs", url));
  const token = await createCoachSession(coachId);
  const activity = url.searchParams.get("activite");
  const view = url.searchParams.get("vue") === "tout-en-un" ? "?vue=tout-en-un" : "";
  const target = activity && /^[0-9a-f-]{36}$/i.test(activity) ? `/entraineur/activites/${activity}${view}` : "/entraineur";
  const res = NextResponse.redirect(new URL(target, url));
  res.cookies.set(COACH_COOKIE_NAME, token, sessionCookie(COACH_SESSION_TTL_SECONDS));
  return res;
}

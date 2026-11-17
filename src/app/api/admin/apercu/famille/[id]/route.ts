import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { PARENT_COOKIE_NAME } from "@/lib/parent-auth";
import { getParentAccount } from "@/lib/parent-repo";
import { createPreviewSession, PREVIEW_TTL_SECONDS } from "@/lib/portal-preview";

/** Ouvre l'espace d'une famille tel qu'elle le voit (aperçu de 2 h, admin seulement). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const account = await getParentAccount(id);
  if (!account) return jsonError("Compte introuvable", 404);
  const token = await createPreviewSession("famille", id, account.fullName || account.email);
  const response = NextResponse.redirect(new URL("/compte", request.url));
  response.cookies.set(PARENT_COOKIE_NAME, token, { httpOnly: true, path: "/", maxAge: PREVIEW_TTL_SECONDS, sameSite: "lax" });
  return response;
}

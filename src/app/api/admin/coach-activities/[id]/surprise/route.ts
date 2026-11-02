import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { setSurpriseMoment } from "@/lib/coach-portal-repo";
import { getActivity } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

/** Moment surprise prévu pour une pratique (briefing de 5 minutes, P1.4.01), préparé par JP. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getActivity(id))) return jsonError("Activité introuvable", 404);
  const body = (await request.json().catch(() => null)) as { text?: string | null } | null;
  await setSurpriseMoment(id, typeof body?.text === "string" ? body.text : null);
  return NextResponse.json({ ok: true });
}

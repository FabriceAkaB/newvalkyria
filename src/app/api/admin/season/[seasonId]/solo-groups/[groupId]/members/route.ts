import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { assignRegistrationToSoloGroup } from "@/lib/season-admin-repo";

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { groupId } = await params;
  const body = (await request.json().catch(() => null)) as { registrationId?: string } | null;
  if (!body?.registrationId) return jsonError("Inscription requise", 400);

  try {
    await assignRegistrationToSoloGroup(groupId, body.registrationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur d'assignation", 500);
  }
}

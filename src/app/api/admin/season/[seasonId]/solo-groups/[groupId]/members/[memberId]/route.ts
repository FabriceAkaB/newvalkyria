import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { removeSoloGroupMember } from "@/lib/season-admin-repo";

export async function DELETE(_request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { memberId } = await params;
  try {
    await removeSoloGroupMember(memberId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de suppression", 500);
  }
}

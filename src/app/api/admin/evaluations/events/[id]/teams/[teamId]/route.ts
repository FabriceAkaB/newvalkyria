import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteTeam } from "@/lib/tryout-repo";

export async function DELETE(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { teamId } = await params;
  await deleteTeam(teamId);
  return NextResponse.json({ ok: true });
}

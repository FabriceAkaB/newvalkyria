import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { bulkAddProgram } from "@/lib/tryout-repo";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { seasonId?: string; programId?: string } | null;
  if (!body?.seasonId || !body.programId) return jsonError("seasonId et programId requis", 400);
  try {
    const result = await bulkAddProgram(id, body.seasonId, body.programId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

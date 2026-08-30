import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { bulkAddTrials } from "@/lib/tryout-repo";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { seasonId?: string } | null;
  if (!body?.seasonId) return jsonError("seasonId requis", 400);
  try {
    const result = await bulkAddTrials(id, body.seasonId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

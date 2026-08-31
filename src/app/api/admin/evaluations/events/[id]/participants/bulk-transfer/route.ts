import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { bulkAddBySource, type BulkAddSource } from "@/lib/tryout-repo";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { source?: BulkAddSource } | null;
  if (!body?.source?.type) return jsonError("source requise", 400);
  try {
    const result = await bulkAddBySource(id, body.source);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { duplicateEvent } from "@/lib/tryout-repo";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: string; eventDate?: string } | null;
  if (!body?.name || !body.eventDate) return jsonError("Nom et date requis", 400);
  try {
    const newId = await duplicateEvent(id, body.name, body.eventDate);
    return NextResponse.json({ id: newId });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

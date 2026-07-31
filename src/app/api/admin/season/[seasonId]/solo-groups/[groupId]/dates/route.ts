import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addSoloGroupDate } from "@/lib/season-admin-repo";

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { groupId } = await params;
  const body = (await request.json().catch(() => null)) as { occursOn?: string } | null;
  if (!body?.occursOn) return jsonError("Date requise", 400);

  try {
    const id = await addSoloGroupDate(groupId, body.occursOn);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur d'ajout", 500);
  }
}

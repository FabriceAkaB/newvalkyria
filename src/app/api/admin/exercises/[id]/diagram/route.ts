import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { parseExerciseDiagram, setExerciseDiagram } from "@/lib/exercises-repo";
import { jsonError } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = await request.json().catch(() => undefined);
  const diagram = parseExerciseDiagram(body);
  if (diagram === undefined) return jsonError("Schéma invalide", 400);

  await setExerciseDiagram(id, diagram);
  return NextResponse.json({ ok: true });
}

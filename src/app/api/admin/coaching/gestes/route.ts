import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { createGesture, parseGestureInput, updateGesture } from "@/lib/coaching-method-repo";
import { jsonError } from "@/lib/http";

/** Bibliothèque des gestes de la méthode Valkyria (réservé à l'admin : c'est JP qui écrit la méthode). */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const g = parseGestureInput(((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>);
  if (typeof g === "string") return jsonError(g, 422);
  const id = await createGesture(g);
  return NextResponse.json({ ok: true, id }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return jsonError("Paramètres invalides", 400);
  const g = parseGestureInput(body);
  if (typeof g === "string") return jsonError(g, 422);
  await updateGesture(body.id, g);
  return NextResponse.json({ ok: true });
}

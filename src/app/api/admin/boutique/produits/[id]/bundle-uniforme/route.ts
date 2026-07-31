import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setUniformBundleRole, type UniformBundleRole } from "@/lib/shop-repo";

const VALID_ROLES: readonly string[] = ["jersey", "short", "socks"] satisfies readonly UniformBundleRole[];

/** Marque ce produit avec un rôle dans l'offre "2e uniforme" (un seul produit par rôle). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { role?: string } | null;
  if (!body?.role || !VALID_ROLES.includes(body.role)) return jsonError("Rôle invalide", 400);

  try {
    await setUniformBundleRole(id, body.role as UniformBundleRole);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    await setUniformBundleRole(id, null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }
}

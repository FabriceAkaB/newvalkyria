import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteVariant, updateVariant } from "@/lib/shop-repo";
import { variantSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if ("active" in body && Object.keys(body).length === 1) {
      await updateVariant(id, { active: Boolean(body.active) });
      return NextResponse.json({ ok: true });
    }
    const payload = variantSchema.partial().parse(body);
    await updateVariant(id, {
      label: payload.label,
      size: payload.size !== undefined ? payload.size || null : undefined,
      color: payload.color !== undefined ? payload.color || null : undefined,
      sku: payload.sku !== undefined ? payload.sku || null : undefined,
      inventoryCount: payload.inventoryCount
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    await deleteVariant(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

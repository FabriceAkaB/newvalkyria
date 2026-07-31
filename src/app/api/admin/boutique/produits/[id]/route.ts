import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteProduct, updateProduct } from "@/lib/shop-repo";
import { productSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if ("active" in body && Object.keys(body).length === 1) {
      await updateProduct(id, { active: Boolean(body.active) });
      return NextResponse.json({ ok: true });
    }
    const payload = productSchema.partial().parse(body);
    await updateProduct(id, {
      name: payload.name,
      description: payload.description !== undefined ? payload.description || null : undefined,
      priceCents: payload.priceCents,
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
    await deleteProduct(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

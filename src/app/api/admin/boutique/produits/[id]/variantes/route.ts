import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createVariant } from "@/lib/shop-repo";
import { variantSchema } from "@/lib/validations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    const payload = variantSchema.parse(await request.json());
    const variantId = await createVariant(id, {
      label: payload.label,
      size: payload.size || null,
      color: payload.color || null,
      sku: payload.sku || null,
      inventoryCount: payload.inventoryCount
    });
    return NextResponse.json({ ok: true, id: variantId }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

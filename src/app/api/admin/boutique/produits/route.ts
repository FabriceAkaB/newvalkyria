import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createProduct, getProducts } from "@/lib/shop-repo";
import { productSchema } from "@/lib/validations";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const products = await getProducts(true);
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);

  try {
    const payload = productSchema.parse(await request.json());
    const id = await createProduct({
      name: payload.name,
      description: payload.description || null,
      priceCents: payload.priceCents,
      inventoryCount: payload.inventoryCount
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

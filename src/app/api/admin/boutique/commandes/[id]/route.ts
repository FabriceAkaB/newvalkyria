import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import type { OrderStatus } from "@/lib/shop-repo";
import { updateOrderStatus } from "@/lib/shop-repo";

const VALID_STATUSES: readonly string[] = ["pending", "paid", "fulfilled", "cancelled"] satisfies readonly OrderStatus[];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (!body?.status || !VALID_STATUSES.includes(body.status)) return jsonError("Statut invalide", 400);

  try {
    await updateOrderStatus(id, body.status as OrderStatus);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

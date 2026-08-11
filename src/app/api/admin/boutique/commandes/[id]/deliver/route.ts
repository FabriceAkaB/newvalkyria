import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { recordDelivery } from "@/lib/shop-repo";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    deliveries?: { itemId: string; deliveredQuantity: number }[];
    deliveredBy?: string;
    parentConfirmed?: boolean;
  } | null;

  if (!body?.deliveries || body.deliveries.length === 0 || !body.deliveredBy?.trim()) {
    return jsonError("Paramètres invalides", 400);
  }

  await recordDelivery(id, body.deliveries, body.deliveredBy.trim(), Boolean(body.parentConfirmed));
  return NextResponse.json({ ok: true });
}

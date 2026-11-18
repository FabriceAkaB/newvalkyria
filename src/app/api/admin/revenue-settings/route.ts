import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setRevenueTaxRate } from "@/lib/revenue-repo";

export async function PUT(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json()) as { revenueTaxRate?: number; revenueTaxFrom?: string | null };

  if (typeof body.revenueTaxRate !== "number" || body.revenueTaxRate < 0 || body.revenueTaxRate > 1) {
    return jsonError("Taux invalide", 400);
  }

  if (body.revenueTaxFrom != null && !/^\d{4}-\d{2}-\d{2}$/.test(body.revenueTaxFrom)) return jsonError("Date invalide", 400);

  await setRevenueTaxRate(body.revenueTaxRate, body.revenueTaxFrom === undefined ? undefined : body.revenueTaxFrom);
  return NextResponse.json({ ok: true });
}

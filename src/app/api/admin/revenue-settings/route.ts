import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setRevenueTaxRate } from "@/lib/revenue-repo";

export async function PUT(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json()) as { revenueTaxRate?: number };

  if (typeof body.revenueTaxRate !== "number" || body.revenueTaxRate < 0 || body.revenueTaxRate > 1) {
    return jsonError("Taux invalide", 400);
  }

  await setRevenueTaxRate(body.revenueTaxRate);
  return NextResponse.json({ ok: true });
}

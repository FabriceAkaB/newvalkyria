import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteRevenueExpense } from "@/lib/revenue-repo";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) {
    return jsonError("Non autorisé", 401);
  }

  const { id } = await params;
  if (!id) {
    return jsonError("ID manquant", 400);
  }

  await deleteRevenueExpense(id);
  return NextResponse.json({ ok: true });
}

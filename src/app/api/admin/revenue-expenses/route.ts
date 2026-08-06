import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addRevenueExpense } from "@/lib/revenue-repo";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json()) as { seasonKey?: string; label?: string; amountCents?: number; expenseDate?: string };

  if (!body.seasonKey || !body.label?.trim() || typeof body.amountCents !== "number" || body.amountCents <= 0 || !body.expenseDate) {
    return jsonError("Données invalides", 400);
  }

  const expense = await addRevenueExpense({
    seasonKey: body.seasonKey,
    label: body.label.trim(),
    amountCents: Math.round(body.amountCents),
    expenseDate: body.expenseDate
  });

  return NextResponse.json({ ok: true, expense }, { status: 201 });
}

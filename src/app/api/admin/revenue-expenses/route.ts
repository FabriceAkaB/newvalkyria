import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addRevenueExpense, EXPENSE_CATEGORIES } from "@/lib/revenue-repo";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json()) as {
    seasonKey?: string;
    category?: string;
    label?: string;
    amountCents?: number;
    expenseDate?: string;
    isRecurring?: boolean;
    recurrenceEndDate?: string | null;
  };

  if (!body.seasonKey || !body.label?.trim() || typeof body.amountCents !== "number" || body.amountCents <= 0 || !body.expenseDate) {
    return jsonError("Données invalides", 400);
  }

  const category = body.category && (EXPENSE_CATEGORIES as readonly string[]).includes(body.category) ? body.category : "Autre";

  const expense = await addRevenueExpense({
    seasonKey: body.seasonKey,
    category,
    label: body.label.trim(),
    amountCents: Math.round(body.amountCents),
    expenseDate: body.expenseDate,
    isRecurring: Boolean(body.isRecurring),
    recurrenceEndDate: body.recurrenceEndDate || null
  });

  return NextResponse.json({ ok: true, expense }, { status: 201 });
}

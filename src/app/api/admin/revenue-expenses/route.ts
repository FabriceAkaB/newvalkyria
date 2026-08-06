import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addRevenueExpense, EXPENSE_CATEGORIES, PAYMENT_ACCOUNTS } from "@/lib/revenue-repo";

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
    taxRate?: number;
    paidWith?: string;
  };

  if (!body.seasonKey || !body.label?.trim() || typeof body.amountCents !== "number" || body.amountCents <= 0 || !body.expenseDate) {
    return jsonError("Données invalides", 400);
  }

  const category = body.category && (EXPENSE_CATEGORIES as readonly string[]).includes(body.category) ? body.category : "Autre";
  const paidWith = body.paidWith && (PAYMENT_ACCOUNTS as readonly string[]).includes(body.paidWith) ? body.paidWith : "Compte bancaire";
  const taxRate = typeof body.taxRate === "number" && body.taxRate >= 0 && body.taxRate <= 1 ? body.taxRate : 0;

  const expense = await addRevenueExpense({
    seasonKey: body.seasonKey,
    category,
    label: body.label.trim(),
    amountCents: Math.round(body.amountCents),
    expenseDate: body.expenseDate,
    isRecurring: Boolean(body.isRecurring),
    recurrenceEndDate: body.recurrenceEndDate || null,
    taxRate,
    paidWith
  });

  return NextResponse.json({ ok: true, expense }, { status: 201 });
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addIncomeEntry, INCOME_CATEGORIES, PAYMENT_ACCOUNTS } from "@/lib/revenue-repo";

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json()) as {
    seasonKey?: string;
    category?: string;
    label?: string;
    amountCents?: number;
    incomeDate?: string;
    taxRate?: number;
    paidWith?: string;
    notes?: string | null;
  };

  if (!body.seasonKey || !body.label?.trim() || typeof body.amountCents !== "number" || body.amountCents <= 0 || !body.incomeDate) {
    return jsonError("Données invalides", 400);
  }

  const category = body.category && (INCOME_CATEGORIES as readonly string[]).includes(body.category) ? body.category : "Autre";
  const paidWith = body.paidWith && (PAYMENT_ACCOUNTS as readonly string[]).includes(body.paidWith) ? body.paidWith : "Compte bancaire";
  const taxRate = typeof body.taxRate === "number" && body.taxRate >= 0 && body.taxRate <= 1 ? body.taxRate : 0;

  const income = await addIncomeEntry({
    seasonKey: body.seasonKey,
    category,
    label: body.label.trim(),
    amountCents: Math.round(body.amountCents),
    incomeDate: body.incomeDate,
    paidWith,
    taxRate,
    notes: body.notes?.trim() || null
  });

  return NextResponse.json({ ok: true, income }, { status: 201 });
}

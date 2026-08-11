import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { EXPENSE_CATEGORIES, getBudgets, setBudget } from "@/lib/revenue-repo";

export async function GET() {
  if (!(await isAdminRequest({ roles: ["admin"] }))) {
    return jsonError("Non autorisé", 401);
  }
  const budgets = await getBudgets();
  return NextResponse.json({ budgets });
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json().catch(() => null)) as { category?: string; amountCents?: number } | null;
  if (!body?.category || !(EXPENSE_CATEGORIES as readonly string[]).includes(body.category) || typeof body.amountCents !== "number" || body.amountCents < 0) {
    return jsonError("Paramètres invalides", 400);
  }

  await setBudget(body.category, Math.round(body.amountCents));
  return NextResponse.json({ ok: true });
}

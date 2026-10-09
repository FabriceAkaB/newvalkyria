import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getCodeRows, getCreditOverview, getFinancialSummary, getReferralAdminRows } from "@/lib/private-programs-admin";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const [referrals, credits, codes, financials] = await Promise.all([getReferralAdminRows(), getCreditOverview(), getCodeRows(), getFinancialSummary()]);
  return NextResponse.json({ referrals, credits, codes, financials });
}

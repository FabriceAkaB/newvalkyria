import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getAllLeads } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const leads = await getAllLeads();
  return NextResponse.json({ leads });
}

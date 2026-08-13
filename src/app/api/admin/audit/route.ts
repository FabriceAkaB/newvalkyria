import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getAuditLog } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";

export async function GET(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") ?? undefined;
  const entries = await getAuditLog({ entityType });
  return NextResponse.json({ entries });
}

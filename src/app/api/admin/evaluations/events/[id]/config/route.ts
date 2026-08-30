import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getCriteriaConfigForEvent } from "@/lib/tryout-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const config = await getCriteriaConfigForEvent(id);
  return NextResponse.json({ config });
}

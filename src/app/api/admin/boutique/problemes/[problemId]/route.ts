import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { resolveOrderProblem } from "@/lib/shop-repo";

export async function PATCH(_request: Request, { params }: { params: Promise<{ problemId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { problemId } = await params;
  await resolveOrderProblem(problemId);
  return NextResponse.json({ ok: true });
}

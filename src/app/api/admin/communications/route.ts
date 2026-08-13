import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getCommunicationHistory } from "@/lib/communications-repo";
import { jsonError } from "@/lib/http";

export async function GET() {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const history = await getCommunicationHistory();
  return NextResponse.json({ history });
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getAllSessions } from "@/lib/sport-etudes-repo";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const sessions = await getAllSessions();
  return NextResponse.json({ sessions });
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getOrCreateCalendarFeedToken, regenerateCalendarFeedToken } from "@/lib/calendar-repo";
import { jsonError } from "@/lib/http";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const token = await getOrCreateCalendarFeedToken();
  return NextResponse.json({ token });
}

export async function POST() {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const token = await regenerateCalendarFeedToken();
  return NextResponse.json({ token });
}

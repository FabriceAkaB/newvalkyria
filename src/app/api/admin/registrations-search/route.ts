import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { searchRegistrations } from "@/lib/season-admin-repo";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const registrations = await searchRegistrations(q);
  return NextResponse.json({ registrations });
}

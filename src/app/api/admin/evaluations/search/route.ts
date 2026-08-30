import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { searchAthletes } from "@/lib/tryout-repo";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const eventId = url.searchParams.get("eventId") ?? "";
  if (!eventId) return jsonError("eventId requis", 400);
  const results = await searchAthletes(q, eventId);
  return NextResponse.json({ results });
}

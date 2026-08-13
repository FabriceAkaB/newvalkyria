import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { globalSearch } from "@/lib/search-repo";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const results = await globalSearch(q);
  return NextResponse.json(results);
}

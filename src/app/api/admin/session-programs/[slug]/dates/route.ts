import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getProgramDates, type SessionProgramSlug } from "@/lib/session-programs-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { slug } = await params;
  const dates = await getProgramDates(slug as SessionProgramSlug);
  return NextResponse.json({ dates });
}

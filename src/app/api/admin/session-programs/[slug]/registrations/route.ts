import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getAllRegistrations, type SessionProgramSlug } from "@/lib/session-programs-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { slug } = await params;
  const registrations = await getAllRegistrations(slug as SessionProgramSlug);
  return NextResponse.json({ registrations });
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { parseReview } from "@/lib/weekly-review";
import { saveReview } from "@/lib/weekly-review-repo";

/** Bilan de la semaine de JP : les 3 réponses (réservé à l'admin). */
export async function PUT(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = body ? parseReview(body) : "Paramètres invalides";
  if (typeof parsed === "string") return jsonError(parsed, 400);
  await saveReview(parsed.weekStart, parsed.answers);
  return NextResponse.json({ ok: true });
}

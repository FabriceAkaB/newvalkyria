import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { setModuleValidated } from "@/lib/coach-training-repo";
import { jsonError } from "@/lib/http";

/** Formation des éducateurs : JP valide un module après observation. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { coachId?: string; module?: string; on?: boolean; note?: string } | null;
  if (typeof b?.coachId !== "string" || typeof b.module !== "string" || typeof b.on !== "boolean") return jsonError("Paramètres invalides", 400);
  await setModuleValidated(b.coachId, b.module, b.on, b.note?.trim().slice(0, 500) || null);
  return NextResponse.json({ ok: true });
}

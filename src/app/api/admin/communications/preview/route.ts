import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { resolveAudience, TARGET_TYPES, type AudienceCriteria, type TargetType } from "@/lib/communications-repo";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { targetType?: TargetType; criteria?: AudienceCriteria } | null;
  if (!body?.targetType || !(TARGET_TYPES as readonly string[]).includes(body.targetType)) {
    return jsonError("Cible invalide", 400);
  }

  const recipients = await resolveAudience(body.targetType, body.criteria ?? {});
  return NextResponse.json({ count: recipients.length, sample: recipients.slice(0, 10) });
}

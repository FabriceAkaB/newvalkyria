import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { getMcsRules, saveMcsRules } from "@/lib/mcs-rules-repo";

/** Règles du lien académie ↔ MonClubSportif (par club), modifiables par l'admin. */
export async function GET() {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  return NextResponse.json({ rules: await getMcsRules() });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const before = await getMcsRules();
  const rules = await saveMcsRules(await request.json().catch(() => null));
  await logAudit({ actorRole: "admin", actorLabel: "Admin", action: "mcs_rules_saved", entityType: "app_settings", entityId: "mcs_rules", entityLabel: "Règles MonClubSportif", before: before as unknown as object, after: rules as unknown as object }).catch(() => null);
  return NextResponse.json({ ok: true, rules });
}

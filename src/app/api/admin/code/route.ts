import { NextResponse } from "next/server";

import { changeAccessCode, isAdminRequest, type AdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";

/** Codes d'accès (admin seulement) : JP change son code, celui de la gérante ou celui de la borne. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { target?: string; current?: string; next?: string } | null;
  const target = (["admin", "gerante", "borne"] as const).find((t) => t === b?.target);
  if (!target || typeof b?.current !== "string" || typeof b.next !== "string") return jsonError("Paramètres invalides", 400);
  try {
    await changeAccessCode({ target: target as AdminRole, current: b.current, next: b.next });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 422);
  }
  await logAudit({ actorRole: "admin", actorLabel: "JP", action: "access_code_changed", entityType: "app_settings", entityId: "admin_password_hashes", entityLabel: `Code ${target} changé` }).catch(() => null);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { setWeeklyActive } from "@/lib/weekly-parent-message-repo";

/** Interrupteur Actif / Inactif du message de la semaine aux parents (admin et gérante). N'envoie rien. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin" && role !== "gerante") return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { actif?: unknown } | null;
  if (typeof b?.actif !== "boolean") return jsonError("Paramètres invalides", 400);
  const settings = await setWeeklyActive(b.actif);
  await logAudit({
    actorRole: role,
    actorLabel: role === "admin" ? "JP" : "Gérante",
    action: b.actif ? "message_hebdo_actif" : "message_hebdo_inactif",
    entityType: "app_settings",
    entityId: "message_hebdo_parents",
    entityLabel: "Message de la semaine aux parents"
  }).catch(() => undefined);
  return NextResponse.json({ ok: true, settings });
}

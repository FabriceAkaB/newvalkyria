import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { cancelScheduledEmails } from "@/lib/scheduled-emails";

/** Annule une campagne de courriels programmés avant son heure (admin seulement). */
export async function DELETE(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { campaign?: string } | null;
  const campaign = String(body?.campaign ?? "").trim();
  if (!campaign) return jsonError("Envoi requis.", 400);
  await cancelScheduledEmails({ campaign });
  await logAudit({ actorRole: "admin", actorLabel: "Admin", action: "scheduled_emails_cancelled", entityType: "scheduled_emails", entityId: campaign, entityLabel: campaign }).catch(() => null);
  return NextResponse.json({ ok: true });
}

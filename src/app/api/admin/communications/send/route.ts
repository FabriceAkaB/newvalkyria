import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logCommunication, resolveAudience, TARGET_TYPES, type AudienceCriteria, type TargetType } from "@/lib/communications-repo";
import { sendBroadcastEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";

export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as {
    targetType?: TargetType;
    criteria?: AudienceCriteria;
    targetLabel?: string;
    subject?: string;
    message?: string;
  } | null;

  if (!body?.targetType || !(TARGET_TYPES as readonly string[]).includes(body.targetType)) {
    return jsonError("Cible invalide", 400);
  }
  if (!body.subject?.trim() || !body.message?.trim()) {
    return jsonError("Sujet et message requis", 400);
  }

  const recipients = await resolveAudience(body.targetType, body.criteria ?? {});
  if (recipients.length === 0) {
    return jsonError("Aucun destinataire pour cette cible", 400);
  }

  const results = await Promise.allSettled(
    recipients.map((r) => sendBroadcastEmail({ to: r.email, subject: body.subject!.trim(), body: body.message!.trim() }))
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  const failed = recipients.length - sent;

  await logCommunication({
    senderRole: role,
    targetType: body.targetType,
    targetLabel: body.targetLabel?.trim() || body.targetType,
    targetCriteria: body.criteria ?? {},
    subject: body.subject.trim(),
    body: body.message.trim(),
    recipientCount: sent
  });

  return NextResponse.json({ ok: true, sent, failed, total: recipients.length });
}

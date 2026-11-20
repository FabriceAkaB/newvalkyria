import { NextResponse } from "next/server";

import { sendAdminCodeReset, consumeAdminCodeReset } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";

/** Code administrateur oublié : POST {} envoie le lien à JP ; POST {token, next} enregistre le nouveau code.
 *  La réponse ne dit jamais à qui le courriel est parti. */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as { token?: string; next?: string } | null;
  if (b?.token && typeof b.next === "string") {
    try {
      await consumeAdminCodeReset(b.token, b.next);
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Erreur", 422);
    }
    await logAudit({ actorRole: "admin", actorLabel: "JP (lien de récupération)", action: "access_code_changed", entityType: "app_settings", entityId: "admin_password_hashes", entityLabel: "Code administrateur changé par le lien « code oublié »" }).catch(() => null);
    return NextResponse.json({ ok: true });
  }
  await sendAdminCodeReset().catch(() => false);
  return NextResponse.json({ ok: true });
}

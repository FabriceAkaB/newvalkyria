import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit-repo";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { clearRobotCredentials, saveRobotCredentials } from "@/lib/mcs-robot-config";

/** Compte robot MonClubSportif : enregistré chiffré par JP depuis l'admin. Réservé à l'admin. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Courriel du compte robot invalide.", 400);
  if (password.length < 6 || password.length > 200) return jsonError("Mot de passe invalide.", 400);
  await saveRobotCredentials(email, password);
  await logAudit({ actorRole: "admin", actorLabel: "Admin", action: "mcs_robot_saved", entityType: "app_settings", entityId: "mcs_robot", entityLabel: "Compte robot MonClubSportif", before: null, after: { email } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  await clearRobotCredentials();
  return NextResponse.json({ ok: true });
}

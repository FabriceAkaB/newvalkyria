import { after, NextResponse } from "next/server";

import { logAudit } from "@/lib/audit-repo";
import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { McsSession } from "@/lib/mcs-robot";
import { clearRobotCredentials, saveRobotCredentials } from "@/lib/mcs-robot-config";
import { runMcsRobot } from "@/lib/mcs-robot-runner";
import { getMcsRules, saveMcsRules } from "@/lib/mcs-rules-repo";

export const maxDuration = 300;

/** Compte robot MonClubSportif : enregistré chiffré par JP depuis l'admin. Réservé à l'admin.
 *  La connexion est essayée avant d'enregistrer (un mauvais mot de passe est refusé tout de suite) ; une fois le compte bon,
 *  le robot s'active et fait aussitôt ce qui manque (joueuses payées pas encore dans leurs équipes, photos, calendrier). */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Courriel du compte robot invalide.", 400);
  if (password.length < 6 || password.length > 200) return jsonError("Mot de passe invalide.", 400);
  try {
    await new McsSession().login(email, password);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Connexion à MonClubSportif impossible.", 400);
  }
  await saveRobotCredentials(email, password);
  const rules = await getMcsRules();
  if (!rules.robotActive) await saveMcsRules({ ...rules, robotActive: true });
  await logAudit({ actorRole: "admin", actorLabel: "Admin", action: "mcs_robot_saved", entityType: "app_settings", entityId: "mcs_robot", entityLabel: "Compte robot MonClubSportif", before: null, after: { email, activated: !rules.robotActive } }).catch(() => null);
  after(async () => {
    await runMcsRobot({ reason: "compte robot enregistré" }).catch((err) => console.error("MCS robot after save failed", err));
  });
  return NextResponse.json({ ok: true, activated: true });
}

export async function DELETE() {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  await clearRobotCredentials();
  return NextResponse.json({ ok: true });
}

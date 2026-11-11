import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { applyLessonsToNextWeek, getLessonTargetById } from "@/lib/match-results";

export const dynamic = "force-dynamic";

/** GET : où iront les priorités du match (semaine, thème prévu, déjà ajoutées ?).
 *  Sert aussi au panneau d'après-match du portail : le bouton n'apparaît que si JP est connecté à l'admin. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  const { id } = await params;
  const target = await getLessonTargetById(id).catch(() => null);
  if (!target) return jsonError("Match introuvable", 404);
  return NextResponse.json({ target });
}

/** POST : « Ajouter au thème de la semaine prochaine » (season_themes.notes, sans doublon). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  const { id } = await params;
  try {
    const out = await applyLessonsToNextWeek(id);
    await logAudit({ actorRole: role, actorLabel: role, action: "match_lessons_to_theme", entityType: "season_themes", entityId: out.weekStart, entityLabel: out.theme, after: { line: out.line } }).catch(() => null);
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}

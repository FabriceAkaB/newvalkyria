import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { clearClubLogo, setClubLogo } from "@/lib/club-logos";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Ajoute ou remplace le logo du club d'une équipe (formulaire : profileId + file). */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const form = await request.formData().catch(() => null);
  const profileId = form?.get("profileId");
  const file = form?.get("file");
  if (typeof profileId !== "string" || !(file instanceof File)) return jsonError("Choisissez une image.", 400);
  try {
    const url = await setClubLogo(profileId, file);
    await logAudit({ actorRole: role, actorLabel: role, action: "club_logo_set", entityType: "match_team_profiles", entityId: profileId, after: { logo_url: url } }).catch(() => null);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}

export async function DELETE(request: Request) {
  if (!(await getCurrentAdminRole())) return jsonError("Non autorisé", 401);
  const profileId = new URL(request.url).searchParams.get("profileId");
  if (!profileId) return jsonError("Équipe requise.", 400);
  try {
    await clearClubLogo(profileId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}

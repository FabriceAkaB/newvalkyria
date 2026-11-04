import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { parseBirthYears } from "@/lib/mcs-teams";
import { deleteTeam, saveTeam, syncTeam } from "@/lib/mcs-teams-repo";

/** Équipes MonClubSportif : ajouter ou modifier (nom, années, lien « Sync »), relire, retirer. Réservé à l'admin. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { action?: string; id?: string; name?: string; years?: string; gender?: string; icalUrl?: string | null; active?: boolean } | null;
  if (!body) return jsonError("Paramètres invalides", 400);
  try {
    if (body.action === "sync" && body.id) return NextResponse.json(await syncTeam(body.id));
    if (body.action === "delete" && body.id) {
      await deleteTeam(body.id);
      return NextResponse.json({ ok: true });
    }
    const name = String(body.name ?? "").trim();
    if (!name) return jsonError("Donnez le nom de l'équipe tel qu'il est dans MonClubSportif.", 400);
    const gender = body.gender === "garcons" || body.gender === "mixte" ? body.gender : "filles";
    const id = await saveTeam({ id: body.id, name, birthYears: parseBirthYears(String(body.years ?? "")), gender, icalUrl: body.icalUrl, active: body.active });
    const sync = body.icalUrl ? await syncTeam(id) : null;
    return NextResponse.json({ ok: true, id, sync });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Erreur", 422);
  }
}

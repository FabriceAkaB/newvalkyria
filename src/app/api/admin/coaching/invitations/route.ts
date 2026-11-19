import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { cancelInvite, confirmInvites, runPracticeInvites, saveInviteSettings, savePriority } from "@/lib/practice-invites-repo";

/** Invitations à l'avancé (JP ou la gérante) : confirmer l'envoi, retirer une proposition, ordre des priorités,
 *  réglages, lecture immédiate de MonClubSportif. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  if (action === "confirmer" && typeof body?.slotId === "string" && typeof body.date === "string") return NextResponse.json(await confirmInvites(body.slotId, body.date));
  if (action === "retirer" && typeof body?.id === "string") {
    await cancelInvite(body.id);
    return NextResponse.json({ ok: true });
  }
  if (action === "priorite" && typeof body?.slotId === "string" && Array.isArray(body.pinned)) {
    await savePriority(body.slotId, body.pinned.filter((x): x is string => typeof x === "string"));
    return NextResponse.json({ ok: true });
  }
  if (action === "reglages") {
    await saveInviteSettings(body?.settings);
    return NextResponse.json({ ok: true });
  }
  if (action === "lire") return NextResponse.json(await runPracticeInvites());
  return jsonError("Action inconnue", 400);
}

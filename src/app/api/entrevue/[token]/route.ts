import { NextResponse } from "next/server";

import { chooseInterviewSlot } from "@/lib/content-repo";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Une famille choisit le moment de l'entrevue filmée de sa fille (lien personnel), ou dit qu'elle ne vient pas. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return jsonError("Lien invalide", 404);
  const body = await request.json().catch(() => null);
  const slotId = body?.slotId === null ? null : typeof body?.slotId === "string" && /^[0-9a-f-]{36}$/.test(body.slotId) ? body.slotId : undefined;
  if (slotId === undefined) return jsonError("Choix manquant");
  try {
    const r = await chooseInterviewSlot(token, slotId);
    if (!r.ok) return jsonError(r.error, 400);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Entrevue choose failed", err);
    return jsonError("Erreur, réessayez dans un instant.", 500);
  }
}

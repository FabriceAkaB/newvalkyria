import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/http";
import { reservePosition, withdrawPosition } from "@/lib/referees-repo";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["reserve", "withdraw"]), assignmentId: z.string().uuid() });

/** Lien personnel de l'arbitre : réserver un poste ou s'en retirer (48 h avant au plus tard). */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Demande invalide");
  try {
    const r = parsed.data.action === "reserve" ? await reservePosition(token, parsed.data.assignmentId) : await withdrawPosition(token, parsed.data.assignmentId);
    if (!r.ok) return jsonError(r.error, 409);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Referee action failed", err);
    return jsonError("Erreur, réessayez dans un instant.", 500);
  }
}

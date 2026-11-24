import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getRequestOrigin } from "@/lib/request-origin";
import { startTournamentCheckout } from "@/lib/tournaments-repo";

/** « Payer la place » : ouvre le paiement Stripe des frais de participation (lien personnel de la famille). */
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as { token?: string } | null;
  if (!b?.token) return jsonError("Lien invalide.", 400);
  try {
    const res = await startTournamentCheckout(String(b.token), getRequestOrigin(request));
    if (!res.ok) return jsonError(res.error, 422);
    return NextResponse.json({ url: res.url });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 500);
  }
}

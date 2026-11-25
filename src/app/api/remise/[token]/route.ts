import { after, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { savePickupChoice } from "@/lib/shop-pickup-repo";

/** Le parent choisit la séance où il récupère sa commande de la boutique, et dit si c'est un cadeau (lien personnel, sans compte). */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await request.json().catch(() => null)) as { key?: unknown; isGift?: unknown } | null;
  if (typeof body?.key !== "string") return jsonError("Choisissez une séance.", 400);
  const r = await savePickupChoice(token, { key: body.key, isGift: body.isGift });
  if (!r.ok) return jsonError(r.error, 422);
  after(r.notify);
  return NextResponse.json({ ok: true, when: r.when });
}

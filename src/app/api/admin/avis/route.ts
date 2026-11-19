import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { approveTestimonial, refuseTestimonial, saveReviewSettings, setShowOnSite, testimonialUrl } from "@/lib/family-reviews-repo";
import { jsonError } from "@/lib/http";

/** Avis et témoignages (admin) : voir une vidéo, la valider (crédit versé) ou la refuser, afficher un avis sur le
 *  site, liens des pages d'avis Google et Facebook. Le crédit et les réglages : admin seulement. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const role = await getCurrentAdminRole();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (body?.action === "voir" && typeof body.id === "string") return NextResponse.json({ url: await testimonialUrl(body.id) });
    if (body?.action === "site" && typeof body.id === "string") {
      await setShowOnSite(body.id, body.show === true);
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "refuser" && typeof body.id === "string") {
      await refuseTestimonial(body.id);
      return NextResponse.json({ ok: true });
    }
    if (role !== "admin") return jsonError("Réservé à JP", 403);
    if (body?.action === "valider" && typeof body.id === "string") return NextResponse.json({ review: await approveTestimonial(body.id, "JP") });
    if (body?.action === "reglages") {
      await saveReviewSettings({ googleUrl: body.googleUrl, facebookUrl: body.facebookUrl, videoCreditCents: body.videoCreditCents });
      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 422);
  }
  return jsonError("Action inconnue", 400);
}

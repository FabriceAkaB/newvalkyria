import { NextResponse } from "next/server";

import { attachTestimonial, createTestimonialUpload, markReviewClick, saveReview } from "@/lib/family-reviews-repo";
import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";

/** L'avis du parent (étoiles + texte), ses clics vers Google / Facebook, et son témoignage vidéo. */
export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous à votre espace famille.", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (body?.action === "enregistrer") return NextResponse.json({ review: await saveReview(userId, body) });
    if (body?.action === "clic" && (body.network === "google" || body.network === "facebook")) {
      await markReviewClick(userId, body.network);
      return NextResponse.json({ ok: true });
    }
    if (body?.action === "depot" && typeof body.fileName === "string" && typeof body.contentType === "string") {
      return NextResponse.json(await createTestimonialUpload(userId, { fileName: body.fileName, contentType: body.contentType }));
    }
    if (body?.action === "video" && typeof body.path === "string") return NextResponse.json({ review: await attachTestimonial(userId, body.path, body.consent === true) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 422);
  }
  return jsonError("Action inconnue", 400);
}

import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";
import { attachProgressVideo, createProgressUpload, progressVideoUrl, removeProgressVideo } from "@/lib/progress-videos-repo";

/** Vidéos de progression déposées par l'éducateur vidéaste depuis son portail (JP, 19 nov. 2026). */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const coach = await getCoach(coachId);
  if (!coach?.is_videographer) return jsonError("Réservé au vidéaste de l'académie.", 403);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (body?.action === "depot" && typeof body.registrationId === "string" && typeof body.fileName === "string" && typeof body.contentType === "string") {
      return NextResponse.json(await createProgressUpload(body.registrationId, { fileName: body.fileName, contentType: body.contentType }));
    }
    if (body?.action === "relier" && typeof body.registrationId === "string" && typeof body.path === "string") {
      const video = await attachProgressVideo({ registrationId: body.registrationId, checkpoint: body.checkpoint, title: body.title, note: body.note, path: body.path, fileName: typeof body.fileName === "string" ? body.fileName : undefined, uploadedBy: `${coach.first_name} ${coach.last_name}`.trim() });
      return NextResponse.json({ video });
    }
    if (body?.action === "voir" && typeof body.id === "string") return NextResponse.json({ url: await progressVideoUrl(body.id) });
    if (body?.action === "retirer" && typeof body.id === "string") {
      await removeProgressVideo(body.id);
      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 422);
  }
  return jsonError("Action inconnue", 400);
}

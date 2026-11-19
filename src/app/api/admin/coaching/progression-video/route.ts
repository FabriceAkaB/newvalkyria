import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { attachProgressVideo, createProgressUpload, progressVideoUrl, removeProgressVideo } from "@/lib/progress-videos-repo";

/** Vidéos de progression des joueuses (JP ou la gérante) : dépôt direct, rattachement, aperçu, retrait. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    if (body?.action === "depot" && typeof body.registrationId === "string" && typeof body.fileName === "string" && typeof body.contentType === "string") {
      return NextResponse.json(await createProgressUpload(body.registrationId, { fileName: body.fileName, contentType: body.contentType }));
    }
    if (body?.action === "relier" && typeof body.registrationId === "string" && typeof body.path === "string") {
      const role = await getCurrentAdminRole();
      const video = await attachProgressVideo({ registrationId: body.registrationId, checkpoint: body.checkpoint, title: body.title, note: body.note, path: body.path, fileName: typeof body.fileName === "string" ? body.fileName : undefined, uploadedBy: role === "gerante" ? "Gérante" : "JP" });
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

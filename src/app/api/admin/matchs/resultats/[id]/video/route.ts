import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { attachVideo, createVideoUpload, removeVideo } from "@/lib/match-results";

export const dynamic = "force-dynamic";

/** Vidéo d'un match dans le compartiment PRIVÉ « match-videos » (Loi 25).
 *  POST : prépare un lien de dépôt signé (le navigateur envoie le fichier directement au stockage).
 *  PUT : relie le fichier arrivé à la fiche. DELETE : retire la vidéo déposée. */
const start = z.object({ fileName: z.string().min(1).max(200), contentType: z.string().regex(/^video\//i, "Choisissez un fichier vidéo (mp4, mov…).") });
const attach = z.object({ path: z.string().min(5).max(400) });

async function guard() {
  const role = await getCurrentAdminRole();
  return role === "admin" ? role : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await guard())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const parsed = start.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Fichier invalide", 400);
  try {
    return NextResponse.json(await createVideoUpload(id, parsed.data));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await guard();
  if (!role) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const parsed = attach.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Fichier invalide", 400);
  try {
    await attachVideo(id, parsed.data.path);
    await logAudit({ actorRole: role, actorLabel: role, action: "match_video_uploaded", entityType: "match-videos", entityId: id }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await guard();
  if (!role) return jsonError("Non autorisé", 401);
  const { id } = await params;
  try {
    await removeVideo(id);
    await logAudit({ actorRole: role, actorLabel: role, action: "match_video_removed", entityType: "match-videos", entityId: id }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { uploadPlayerPhoto } from "@/lib/players-repo";

export async function POST(request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { playerId } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return jsonError("Fichier requis", 400);

  try {
    const photoUrl = await uploadPlayerPhoto(playerId, file);
    return NextResponse.json({ photoUrl });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

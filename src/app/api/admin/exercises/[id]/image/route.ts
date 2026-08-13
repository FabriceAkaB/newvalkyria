import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { setExerciseImage } from "@/lib/exercises-repo";
import { jsonError } from "@/lib/http";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");
  if (!file || !(file instanceof File)) return jsonError("Image requise", 400);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return jsonError("Format d'image non supporté", 400);

  try {
    const imageUrl = await setExerciseImage(id, file);
    return NextResponse.json({ ok: true, imageUrl });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

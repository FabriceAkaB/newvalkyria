import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteProductPhoto } from "@/lib/shop-repo";

export async function DELETE(_request: Request, { params }: { params: Promise<{ photoId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { photoId } = await params;

  try {
    await deleteProductPhoto(photoId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

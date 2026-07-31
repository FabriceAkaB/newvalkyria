import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addProductPhoto } from "@/lib/shop-repo";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("photo");
  if (!file || !(file instanceof File)) return jsonError("Aucune photo fournie", 400);
  if (!ALLOWED_TYPES.includes(file.type)) return jsonError("Format d'image non supporté (JPEG, PNG ou WebP)", 415);
  if (file.size > MAX_SIZE) return jsonError("La photo dépasse 5 Mo", 413);

  try {
    const photo = await addProductPhoto(id, file);
    return NextResponse.json({ ok: true, photo });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

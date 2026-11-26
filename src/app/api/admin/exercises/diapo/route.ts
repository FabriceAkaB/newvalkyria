import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { readSlide } from "@/lib/exercise-slide-reader";
import { createExerciseFromSlide, setExerciseClassification } from "@/lib/exercise-slide-repo";
import { jsonError } from "@/lib/http";

export const maxDuration = 60;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/** JP dépose une diapo (image ; un PDF arrive déjà converti en image page par page, avec son texte) :
 *  le site la lit, crée l'exercice dans le bon chapitre et garde la diapo comme visuel. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const form = await request.formData().catch(() => null);
  const file = form?.get("image");
  if (!file || !(file instanceof File)) return jsonError("Image de la diapo requise", 400);
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return jsonError("Format non supporté (PNG, JPG, WebP ou PDF)", 400);
  if (file.size > 4_000_000) return jsonError("Image trop lourde (4 Mo au plus)", 400);
  const text = String(form?.get("text") ?? "").slice(0, 20000);
  const fileName = String(form?.get("fileName") ?? file.name ?? "diapo").slice(0, 200);

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const { draft, by } = await readSlide({ image: { data, mediaType: file.type as ImageType }, text, fileName });
    const { id, imageUrl } = await createExerciseFromSlide(draft, file);
    return NextResponse.json({ ok: true, id, imageUrl, by, draft: { title: draft.title, category: draft.category, exerciseType: draft.exerciseType } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

/** Correction rapide : titre, chapitre (thème), catégorie (type). */
export async function PATCH(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Exercice introuvable", 400);
  try {
    await setExerciseClassification(id, {
      title: typeof body?.title === "string" ? body.title : undefined,
      category: typeof body?.category === "string" ? body.category : undefined,
      exerciseType: body && "exerciseType" in body ? (typeof body.exerciseType === "string" && body.exerciseType ? body.exerciseType : null) : undefined
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

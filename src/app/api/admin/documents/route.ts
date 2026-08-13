import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { addDocument, DOCUMENT_CATEGORIES, getDocumentsForEntity, type DocumentEntityType } from "@/lib/documents-repo";
import { jsonError } from "@/lib/http";

const VALID_ENTITY_TYPES: readonly string[] = ["registration", "lead", "coach"] satisfies readonly DocumentEntityType[];
const DELIVERED_BY_LABEL: Record<"admin" | "gerante", string> = { admin: "JP", gerante: "Gérante" };

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  if (!entityType || !entityId || !VALID_ENTITY_TYPES.includes(entityType)) return jsonError("Paramètres invalides", 400);

  const documents = await getDocumentsForEntity(entityType as DocumentEntityType, entityId);
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);

  const formData = await request.formData().catch(() => null);
  const entityType = formData?.get("entityType");
  const entityId = formData?.get("entityId");
  const category = formData?.get("category");
  const file = formData?.get("file");

  if (typeof entityType !== "string" || !VALID_ENTITY_TYPES.includes(entityType)) return jsonError("Type d'entité invalide", 400);
  if (typeof entityId !== "string" || !entityId) return jsonError("entityId requis", 400);
  if (!file || !(file instanceof File)) return jsonError("Fichier requis", 400);

  const resolvedCategory = typeof category === "string" && (DOCUMENT_CATEGORIES as readonly string[]).includes(category) ? category : "Autre";

  try {
    const id = await addDocument({
      entityType: entityType as DocumentEntityType,
      entityId,
      category: resolvedCategory,
      uploadedBy: DELIVERED_BY_LABEL[role],
      file
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getCertificationDocumentSignedUrl, setCertificationDocument } from "@/lib/certifications-repo";
import { jsonError } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const signedUrl = await getCertificationDocumentSignedUrl(id);
  if (!signedUrl) return jsonError("Aucun document", 404);
  return NextResponse.json({ signedUrl });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("document");
  if (!file || !(file instanceof File)) return jsonError("Document requis", 400);

  try {
    await setCertificationDocument(id, file);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

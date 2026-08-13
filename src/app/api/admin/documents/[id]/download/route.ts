import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getDocumentSignedUrl } from "@/lib/documents-repo";
import { jsonError } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const signedUrl = await getDocumentSignedUrl(id);
  if (!signedUrl) return jsonError("Document introuvable", 404);
  return NextResponse.json({ signedUrl });
}

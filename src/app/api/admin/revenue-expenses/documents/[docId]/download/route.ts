import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getExpenseDocumentSignedUrl } from "@/lib/revenue-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ docId: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { docId } = await params;
  const signed = await getExpenseDocumentSignedUrl(docId);
  if (!signed) return jsonError("Document introuvable", 404);
  return NextResponse.json(signed);
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { deleteDocument } from "@/lib/documents-repo";
import { jsonError } from "@/lib/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  await deleteDocument(id);
  return NextResponse.json({ ok: true });
}

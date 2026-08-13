import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteExpenseDocument } from "@/lib/revenue-repo";

export async function DELETE(_request: Request, { params }: { params: Promise<{ docId: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { docId } = await params;
  await deleteExpenseDocument(docId);
  return NextResponse.json({ ok: true });
}

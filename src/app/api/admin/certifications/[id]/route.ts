import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { deleteCertification } from "@/lib/certifications-repo";
import { jsonError } from "@/lib/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  await deleteCertification(id);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addExpenseDocument, getExpenseDocuments } from "@/lib/revenue-repo";

const MAX_SIZE = 15 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const documents = await getExpenseDocuments(id);
  return NextResponse.json({ documents });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return jsonError("Aucun fichier fourni", 400);
  if (file.size > MAX_SIZE) return jsonError("Le fichier dépasse 15 Mo", 413);

  try {
    const document = await addExpenseDocument(id, file);
    return NextResponse.json({ ok: true, document });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

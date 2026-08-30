import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createExternalPlayerAndAdd } from "@/lib/tryout-repo";
import { tryoutExternalPlayerSchema } from "@/lib/validations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  try {
    const payload = tryoutExternalPlayerSchema.parse(await request.json());
    const result = await createExternalPlayerAndAdd(id, payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

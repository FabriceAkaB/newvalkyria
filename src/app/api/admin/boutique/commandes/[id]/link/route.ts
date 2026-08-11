import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { linkOrderToRegistration, unlinkOrderFromRegistration } from "@/lib/shop-repo";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { registrationId?: string } | null;
  if (!body?.registrationId) return jsonError("Joueuse requise", 400);

  try {
    await linkOrderToRegistration(id, body.registrationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  await unlinkOrderFromRegistration(id);
  return NextResponse.json({ ok: true });
}

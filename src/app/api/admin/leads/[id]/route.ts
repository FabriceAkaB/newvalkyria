import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteLead, updateLeadGoal } from "@/lib/repositories";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const { id } = await params;
  if (!id) {
    return jsonError("ID manquant", 400);
  }

  await deleteLead(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const { id } = await params;
  if (!id) {
    return jsonError("ID manquant", 400);
  }

  const body = (await request.json()) as { goal?: string };
  if (!body.goal) {
    return jsonError("Champ goal manquant", 400);
  }

  await updateLeadGoal(id, body.goal);
  return NextResponse.json({ ok: true });
}

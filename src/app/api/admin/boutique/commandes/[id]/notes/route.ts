import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setOrderNotes } from "@/lib/shop-repo";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { notes?: string } | null;
  if (body?.notes === undefined) return jsonError("Paramètres invalides", 400);

  await setOrderNotes(id, body.notes);
  return NextResponse.json({ ok: true });
}

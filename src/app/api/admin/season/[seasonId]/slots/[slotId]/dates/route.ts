import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addSlotDate, getSlotDates } from "@/lib/season-admin-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const { slotId } = await params;
  try {
    const dates = await getSlotDates(slotId);
    return NextResponse.json({ dates });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de chargement", 500);
  }
}

/** Body: { dates: string[] } — accepte une ou plusieurs dates (YYYY-MM-DD) d'un coup. */
export async function POST(request: Request, { params }: { params: Promise<{ slotId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const { slotId } = await params;
  const body = (await request.json().catch(() => null)) as { dates?: string[] } | null;

  if (!body || !Array.isArray(body.dates) || body.dates.length === 0) {
    return jsonError("Paramètres invalides", 400);
  }

  try {
    await Promise.all(body.dates.map((d) => addSlotDate(slotId, d)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur d'ajout", 500);
  }
}

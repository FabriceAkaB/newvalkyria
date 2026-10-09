import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { confirmReferral, rejectReferral, setBagDelivered } from "@/lib/private-programs-admin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: "confirm" | "reject" | "bag_delivered" | "bag_undo";
    referrerEmail?: string;
    referrerName?: string;
    note?: string;
  } | null;
  if (!body?.action) return jsonError("Action requise", 400);
  const actor = `admin:${role}`;

  try {
    if (body.action === "confirm") {
      await confirmReferral(id, actor, body.referrerEmail ? { email: body.referrerEmail, name: body.referrerName } : undefined);
    } else if (body.action === "reject") {
      await rejectReferral(id, actor, body.note);
    } else if (body.action === "bag_delivered") {
      await setBagDelivered(id, true, actor);
    } else if (body.action === "bag_undo") {
      await setBagDelivered(id, false, actor);
    } else {
      return jsonError("Action inconnue", 400);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

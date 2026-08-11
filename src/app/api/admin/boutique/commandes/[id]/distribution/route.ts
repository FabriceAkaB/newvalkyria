import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { updateDistributionStatus, type DistributionStatus } from "@/lib/shop-repo";

const VALID_STATUSES: readonly string[] = ["a_commander", "en_production", "recu", "pret_a_remettre", "partiellement_remis", "remis"] satisfies readonly DistributionStatus[];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (!body?.status || !VALID_STATUSES.includes(body.status)) return jsonError("Statut invalide", 400);

  await updateDistributionStatus(id, body.status as DistributionStatus);
  return NextResponse.json({ ok: true });
}

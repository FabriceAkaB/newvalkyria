import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { updatePrivateProgram } from "@/lib/private-programs-repo";

/** Réglages d'un programme privé : capacité, prix, supplément, rabais, date du 2e versement, ouverture. */
export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as {
    slug?: string;
    maxCapacity?: number;
    priceCents?: number;
    installmentFeeCents?: number;
    referralDiscountCents?: number;
    secondInstallmentDate?: string | null;
    active?: boolean;
    presentation?: Record<string, unknown>;
  } | null;
  if (!body?.slug) return jsonError("Programme requis", 400);

  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);
  try {
    await updatePrivateProgram(body.slug, {
      maxCapacity: int(body.maxCapacity),
      priceCents: int(body.priceCents),
      installmentFeeCents: int(body.installmentFeeCents),
      referralDiscountCents: int(body.referralDiscountCents),
      secondInstallmentDate: body.secondInstallmentDate === undefined ? undefined : body.secondInstallmentDate || null,
      active: typeof body.active === "boolean" ? body.active : undefined,
      presentation: body.presentation
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

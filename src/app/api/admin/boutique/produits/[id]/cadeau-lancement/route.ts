import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setSignupBonusProduct } from "@/lib/shop-repo";

/** Marque ce produit comme cadeau offert aux N premiers clients d'une saison
 *  (un seul produit à la fois — en poser un nouveau retire l'ancien). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    await setSignupBonusProduct(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }
}

export async function DELETE() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);

  try {
    await setSignupBonusProduct(null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }
}

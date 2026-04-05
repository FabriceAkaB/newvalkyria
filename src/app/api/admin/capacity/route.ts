import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setCapacityConfig } from "@/lib/repositories";

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const { category, maxSpots } = (await request.json()) as {
    category?: string;
    maxSpots?: number;
  };

  if (!category || typeof maxSpots !== "number" || maxSpots < 0) {
    return jsonError("Paramètres invalides", 400);
  }

  try {
    await setCapacityConfig(category, maxSpots);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }

  try {
    revalidateTag("enrollment-capacity", "max");
  } catch {
    // silencieux — le cache se rafraîchira naturellement
  }

  return NextResponse.json({ ok: true });
}

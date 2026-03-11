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

  await setCapacityConfig(category, maxSpots);
  revalidateTag("enrollment-capacity", {});

  return NextResponse.json({ ok: true });
}

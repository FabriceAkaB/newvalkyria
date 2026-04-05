import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getTrialConfig, setTrialConfig } from "@/lib/trial-dates-store";
import type { TrialConfig } from "@/lib/trial-dates-store";

export async function GET() {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  return NextResponse.json(getTrialConfig());
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  try {
    const config = (await request.json()) as TrialConfig;

    if (!config.groups || typeof config.groups !== "object") {
      return jsonError("Format invalide: groups manquant", 400);
    }
    if (!config.lieu || typeof config.lieu !== "string") {
      return jsonError("Format invalide: lieu manquant", 400);
    }

    setTrialConfig(config);
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Données invalides", 400);
  }
}

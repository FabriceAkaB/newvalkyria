import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { generateCodesForAllFamilies } from "@/lib/private-programs-admin";

export async function POST() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  try {
    return NextResponse.json({ ok: true, ...(await generateCodesForAllFamilies()) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

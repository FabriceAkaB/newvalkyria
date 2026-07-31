import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";

/** Codes d'accès valides pour les programmes avancés (TVA / SVA).
 *  Configurés via INSCRIPTION_ACCESS_CODES (séparés par des virgules).
 *  Un code de démonstration est utilisé si la variable n'est pas définie. */
function validCodes(): string[] {
  const raw = process.env.INSCRIPTION_ACCESS_CODES;
  if (raw && raw.trim().length > 0) {
    return raw.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  }
  return ["145"];
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Requête invalide.", 400);
  }

  const code = (body as { code?: unknown }).code;
  if (typeof code !== "string" || code.trim().length === 0) {
    return jsonError("Code requis.", 400);
  }

  const normalized = code.trim().toUpperCase();
  if (!validCodes().includes(normalized)) {
    return jsonError("Code invalide.", 401);
  }

  return NextResponse.json({ ok: true });
}

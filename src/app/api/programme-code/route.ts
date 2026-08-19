import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";

/** Codes de programme fixes — mécanisme séparé de INSCRIPTION_ACCESS_CODES
 *  (invitation-gate.tsx) qui déverrouille des options dans le MÊME parcours
 *  d'inscription. Ici, un code route vers un produit entièrement différent. */
const PROGRAM_CODES: Record<string, string> = {
  "215": "/sport-etudes"
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code?.trim();
  if (!code) return jsonError("Code requis", 400);

  const redirectTo = PROGRAM_CODES[code];
  if (!redirectTo) return jsonError("Code invalide.", 401);

  return NextResponse.json({ redirectTo });
}

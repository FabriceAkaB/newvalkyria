import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { parsePrinciples, parseStructure } from "@/lib/coaching-method";
import { saveMethodDoc } from "@/lib/coaching-method-repo";
import { jsonError } from "@/lib/http";

/** Méthode Valkyria : JP écrit et valide la structure de séance et les principes (réservé à l'admin). */
export async function PUT(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { slug?: string; blocks?: unknown; items?: unknown; validated?: boolean } | null;
  if (body?.slug === "structure") {
    const blocks = parseStructure(body.blocks);
    if (!blocks) return jsonError("Structure invalide : chaque bloc a une place et une durée de 0 à 90 minutes.", 422);
    await saveMethodDoc("structure", { blocks }, body.validated);
    return NextResponse.json({ ok: true });
  }
  if (body?.slug === "principes") {
    const items = parsePrinciples(body.items);
    if (!items) return jsonError("Principes invalides.", 422);
    await saveMethodDoc("principes", { items }, body.validated);
    return NextResponse.json({ ok: true });
  }
  return jsonError("Paramètres invalides", 400);
}

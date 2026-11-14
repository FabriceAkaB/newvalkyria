import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { addNode, deleteNode, moveNode, updateNode } from "@/lib/customer-journey-repo";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const node = z.object({
  kind: z.enum(["etape", "famille", "droit", "academie", "auto", "choix"]),
  title: z.string().min(2).max(300),
  detail: z.string().max(1500).nullable().optional(),
  status: z.enum(["en-place", "en-cours", "prevu"]),
  whereRef: z.string().max(200).nullable().optional()
});
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), parentId: z.string().uuid().nullable(), node }),
  z.object({ action: z.literal("update"), id: z.string().uuid(), node }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("move"), id: z.string().uuid(), dir: z.union([z.literal(-1), z.literal(1)]) })
]);

/** Parcours client (admin et gérante) : ajouter, modifier, déplacer, retirer une étape ou un élément. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin" && role !== "gerante") return jsonError("Non autorisé", 401);
  try {
    const b = schema.parse(await request.json());
    if (b.action === "add") await addNode(b.parentId, b.node);
    else if (b.action === "update") await updateNode(b.id, b.node);
    else if (b.action === "delete") await deleteNode(b.id);
    else await moveNode(b.id, b.dir);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    console.error("Journey update failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}

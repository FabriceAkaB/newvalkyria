import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { addBusinessToSponsors, setFamilySource } from "@/lib/acquisition";
import { ACQ_TABLES, ACQUISITION_SOURCE_IDS, sourceLabel } from "@/lib/acquisition-core";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

// Les quatre tables ont un identifiant uuid : un autre format est refusé (400) au lieu d'une erreur de la base.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref = z.object({ table: z.enum(ACQ_TABLES), id: z.string().regex(UUID) });
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set-source"),
    refs: z.array(ref).min(1).max(50),
    source: z.enum(ACQUISITION_SOURCE_IDS),
    detail: z.string().max(200).nullable().optional(),
    familyLabel: z.string().max(200).optional()
  }),
  z.object({
    action: z.literal("add-sponsor"),
    businessName: z.string().trim().min(1).max(160),
    parentName: z.string().max(160),
    parentEmail: z.string().max(200),
    parentPhone: z.string().max(40).nullable().optional(),
    players: z.array(z.string().max(120)).max(10)
  })
]);

/** « D'où viennent nos familles ? » (/admin/acquisition) : JP indique la source d'une famille déjà inscrite,
 *  ou ajoute l'entreprise d'une famille au suivi des commanditaires. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  try {
    const b = schema.parse(await request.json());
    if (b.action === "set-source") {
      const updated = await setFamilySource({ refs: b.refs, source: b.source, detail: b.detail ?? null });
      await logAudit({
        actorRole: role,
        actorLabel: role === "admin" ? "JP" : "Gérante",
        action: "acquisition_source_set",
        entityType: "family",
        entityId: b.refs[0].id,
        entityLabel: b.familyLabel ?? null,
        after: { source: b.source, label: sourceLabel(b.source), detail: b.detail ?? null, refs: b.refs, updated }
      }).catch(() => {});
      return NextResponse.json({ ok: true, updated });
    }
    const id = await addBusinessToSponsors({ businessName: b.businessName, parentName: b.parentName, parentEmail: b.parentEmail, parentPhone: b.parentPhone ?? null, players: b.players });
    await logAudit({
      actorRole: role,
      actorLabel: role === "admin" ? "JP" : "Gérante",
      action: "acquisition_business_to_sponsor",
      entityType: "sponsor",
      entityId: id,
      entityLabel: b.businessName,
      after: { status: "prospect", parentName: b.parentName, parentEmail: b.parentEmail }
    }).catch(() => {});
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    const message = err instanceof Error ? err.message : "Erreur";
    if (/déjà dans le suivi|requis/.test(message)) return jsonError(message, 409);
    console.error("Acquisition POST failed", err);
    return jsonError("Impossible d'enregistrer pour l'instant.", 500);
  }
}

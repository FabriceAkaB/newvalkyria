import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { endContract, removeRegistryRow, renewContract, reopenContract, saveContract, type ContractRef } from "@/lib/contracts-registry";
import { jsonError } from "@/lib/http";
import { addInventoryItem, adjustQuantity, archiveItem, markReplaced, updateInventoryItem } from "@/lib/inventory-repo";

export const dynamic = "force-dynamic";

/** Contrôle des dépenses (Mandalart P7.6), admin seulement :
 *  - inventaire du matériel (/admin/inventaire) : ajout, modification, quantité, remplacé, retiré ;
 *  - registre des contrats (/admin/registre-contrats) : contrat saisi à la main, précisions d'un contrat
 *    existant, renouvelé, non renouvelé, remis dans le suivi, supprimé. */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const cents = z.number().int().min(0).max(100_000_000);
const shortText = (max: number) => z.string().max(max).nullable().optional();

const itemInput = z.object({
  name: z.string().trim().min(1, "Donnez un nom à l'article.").max(120),
  category: z.enum(["ballons", "dossards", "cones", "mini-buts", "tapis", "cibles", "camera", "premiers-soins", "autre"]),
  quantity: z.number().int().min(0).max(100_000),
  location: shortText(120),
  assignedTo: shortText(120),
  condition: z.enum(["neuf", "bon", "use", "a_remplacer"]),
  purchasedOn: day.nullable().optional(),
  unitCostCents: cents.nullable().optional(),
  lifespanMonths: z.number().int().min(1).max(240).nullable().optional(),
  notes: shortText(1000)
});

const kind = z.enum(["terrain", "gymnase", "embauche", "commandite", "assurance", "logiciel", "fournisseur", "autre"]);
const ref = z
  .object({
    id: z.string().uuid().nullable().optional(),
    sourceType: z.enum(["venue_rental", "employee_contract", "sponsor"]).nullable().optional(),
    sourceId: z.string().min(1).max(80).nullable().optional()
  })
  .refine((r) => !r.sourceType === !r.sourceId, "Contrat d'origine incomplet");
const knownRef = ref.refine((r) => Boolean(r.id || r.sourceType), "Contrat introuvable");

const contractInput = z.object({
  kind,
  title: shortText(160),
  supplier: shortText(160),
  startDate: day.nullable().optional(),
  endDate: day.nullable().optional(),
  renewal: z.enum(["manuel", "automatique", "aucun"]),
  noticeDays: z.number().int().min(0).max(365).nullable().optional(),
  alertDays: z.number().int().min(1).max(365).nullable().optional(),
  amountCents: cents.nullable().optional(),
  amountPeriod: z.enum(["total", "annuel", "mensuel"]).optional(),
  notes: shortText(1000)
});

const schema = z.discriminatedUnion("action", [
  itemInput.extend({ action: z.literal("item-add") }),
  itemInput.extend({ action: z.literal("item-update"), id: z.string().uuid() }),
  z.object({ action: z.literal("item-qty"), id: z.string().uuid(), delta: z.number().int().min(-10_000).max(10_000) }),
  z.object({ action: z.literal("item-replaced"), id: z.string().uuid(), unitCostCents: cents.nullable().optional() }),
  z.object({ action: z.literal("item-archive"), id: z.string().uuid() }),
  z.object({ action: z.literal("contract-save"), ref, contract: contractInput }),
  z.object({ action: z.literal("contract-renew"), ref: knownRef, kind, previousEnd: day.nullable(), newEnd: day, note: shortText(300) }),
  z.object({ action: z.literal("contract-end"), ref: knownRef, kind, note: shortText(300) }),
  z.object({ action: z.literal("contract-reopen"), ref: knownRef, kind }),
  z.object({ action: z.literal("contract-delete"), id: z.string().uuid() })
]);

const refLabel = (r: ContractRef) => (r.sourceType ? `${r.sourceType}:${r.sourceId}` : r.id ?? "nouveau");
/** Nom lisible dans le journal d'audit : le titre saisi s'il y en a un, sinon la référence du contrat d'origine. */
const rowLabel = (before: { title: string | null } | null, r: ContractRef) => before?.title ?? refLabel(r);

/** Message lisible pour JP : celui écrit dans le schéma, sinon un message général. */
function zodMessage(err: ZodError): string {
  const custom = err.issues.find((i) => i.message && !/^Invalid|^Too|^Expected|^Unrecognized/i.test(i.message));
  return custom?.message ?? "Données invalides";
}

export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  try {
    const b = schema.parse(await request.json());
    const audit = (action: string, entityType: string, entityId: string, entityLabel: string | null, before: object | null, after: object | null) =>
      logAudit({ actorRole: role, actorLabel: "JP", action, entityType, entityId, entityLabel, before, after });

    switch (b.action) {
      case "item-add": {
        const { action: _action, ...input } = b;
        const id = await addInventoryItem(input);
        await audit("inventory_add", "inventory_item", id, input.name, null, input);
        return NextResponse.json({ ok: true, id });
      }
      case "item-update": {
        const { action: _action, id, ...input } = b;
        const { before, after } = await updateInventoryItem(id, input);
        await audit("inventory_update", "inventory_item", id, input.name, before, after);
        return NextResponse.json({ ok: true });
      }
      case "item-qty": {
        const r = await adjustQuantity(b.id, b.delta);
        await audit("inventory_quantity", "inventory_item", b.id, r.name, { quantity: r.before }, { quantity: r.quantity });
        return NextResponse.json({ ok: true, quantity: r.quantity });
      }
      case "item-replaced": {
        const before = await markReplaced(b.id, b.unitCostCents ?? null);
        await audit("inventory_replaced", "inventory_item", b.id, before.name, before, { condition: "neuf", unit_cost_cents: b.unitCostCents ?? before.unit_cost_cents });
        return NextResponse.json({ ok: true });
      }
      case "item-archive": {
        const before = await archiveItem(b.id);
        await audit("inventory_archive", "inventory_item", b.id, before.name, before, null);
        return NextResponse.json({ ok: true });
      }
      case "contract-save": {
        const r = await saveContract(b.ref, b.contract);
        await audit("contract_registry_save", "contract_registry", r.id, b.contract.title ?? rowLabel(r.before, b.ref), r.before, b.contract);
        return NextResponse.json({ ok: true, id: r.id });
      }
      case "contract-renew": {
        const r = await renewContract(b.ref, b.kind, b.previousEnd, b.newEnd, b.note);
        await audit("contract_registry_renew", "contract_registry", r.id, rowLabel(r.before, b.ref), r.before, { end_date: b.newEnd, note: b.note ?? null });
        return NextResponse.json({ ok: true });
      }
      case "contract-end": {
        const r = await endContract(b.ref, b.kind, b.note);
        await audit("contract_registry_end", "contract_registry", r.id, rowLabel(r.before, b.ref), r.before, { status: "termine", note: b.note ?? null });
        return NextResponse.json({ ok: true });
      }
      case "contract-reopen": {
        const r = await reopenContract(b.ref, b.kind);
        await audit("contract_registry_reopen", "contract_registry", r.id, rowLabel(r.before, b.ref), r.before, { status: "actif" });
        return NextResponse.json({ ok: true });
      }
      case "contract-delete": {
        const before = await removeRegistryRow(b.id);
        if (before) await audit("contract_registry_delete", "contract_registry", b.id, before.title ?? `${before.source_type}:${before.source_id}`, before, null);
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    if (err instanceof ZodError) return jsonError(zodMessage(err), 400);
    // Refus écrits pour JP dans inventory-repo et contracts-registry (nom manquant, dates inversées, introuvable).
    if (err instanceof Error && /^(Donnez|La date|La nouvelle date|Contrat introuvable|Article introuvable)/.test(err.message)) return jsonError(err.message, 400);
    console.error("Inventaire / registre des contrats POST failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}

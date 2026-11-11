import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { isIsoDate } from "@/lib/launch-calculator";
import { deleteScenario, saveScenario } from "@/lib/launch-scenarios-repo";

export const dynamic = "force-dynamic";

const cents = z.number().int().min(0).max(100_000_000);
const hours = z.number().min(0).max(100_000);
const inputs = z.object({
  priceCents: cents,
  capacity: z.number().int().min(0).max(10_000),
  sessions: z.number().int().min(0).max(1_000),
  hoursPerSession: z.number().min(0).max(24),
  fieldMode: z.enum(["hourly", "contract"]),
  fieldHours: hours.nullable(),
  fieldHourlyCents: cents,
  fieldContractCents: cents,
  coachCount: z.number().int().min(0).max(100),
  coachHours: hours.nullable(),
  coachHourlyCents: cents,
  equipmentCents: cents,
  insuranceCents: cents,
  marketingCents: cents,
  otherFixedCents: cents,
  kitCents: cents,
  paymentsPerFamily: z.number().min(0).max(24),
  otherVariableCents: cents,
  presales: z.number().int().min(0).max(10_000).nullable(),
  startDate: z.string().refine(isIsoDate, "Date de début invalide.").nullable()
});

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    id: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1, "Donnez un nom au scénario.").max(120, "Nom trop long (120 caractères au maximum)."),
    sourceKind: z.enum(["saison", "session"]).nullable(),
    sourceId: z.string().min(1).max(120).nullable(),
    inputs
  }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() })
]);

/** Calculateur de lancement (admin seulement) : enregistrer, mettre à jour ou supprimer un scénario.
 *  Les résultats sont recalculés par le serveur à partir des entrées. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  if (role !== "admin") return jsonError("Réservé à l'administrateur.", 403);
  try {
    const b = schema.parse(await request.json());
    switch (b.action) {
      case "save": {
        const scenario = await saveScenario({ id: b.id ?? null, name: b.name, sourceKind: b.sourceKind, sourceId: b.sourceId, inputs: b.inputs });
        if (!scenario) return jsonError("Ce scénario n'existe plus : utilisez « Enregistrer comme nouveau ».", 404);
        return NextResponse.json({ ok: true, scenario });
      }
      case "delete":
        await deleteScenario(b.id);
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    if (err instanceof ZodError) {
      const named = err.issues.find((i) => i.path[0] === "name" || i.path[i.path.length - 1] === "startDate");
      return jsonError(named?.message ?? "Données invalides : vérifiez les montants et les nombres.", 400);
    }
    console.error("Calculateur POST failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}

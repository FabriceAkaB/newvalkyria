import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import {
  addReferee,
  cancelAssignment,
  listReferees,
  markPaid,
  openAllUpcoming,
  openPositions,
  releaseAssignment,
  sendOpenMatchesEmail,
  sendWelcomeEmail,
  updateMatchCosts,
  updateReferee
} from "@/lib/referees-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const cents = z.number().int().min(0).max(1_000_000);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add-referee"), firstName: z.string().min(1).max(60), lastName: z.string().min(1).max(60), email: z.string().email(), phone: z.string().max(30).nullable().optional(), level: z.string().max(80).nullable().optional(), interacEmail: z.string().max(120).nullable().optional(), sendLink: z.boolean().optional() }),
  z.object({ action: z.literal("referee-status"), id: z.string().uuid(), status: z.enum(["en_attente", "actif", "inactif"]) }),
  z.object({ action: z.literal("open-all") }),
  z.object({ action: z.literal("open-match"), slotId: z.string().uuid() }),
  z.object({ action: z.literal("costs"), slotId: z.string().uuid(), refereesNeeded: z.number().int().min(0).max(4).optional(), refereeFeeCents: cents.optional(), fieldCostCents: cents.optional(), coachCostCents: cents.optional() }),
  z.object({ action: z.literal("release"), assignmentId: z.string().uuid() }),
  z.object({ action: z.literal("cancel"), assignmentId: z.string().uuid() }),
  z.object({ action: z.literal("paid"), assignmentId: z.string().uuid(), note: z.string().max(300).nullable() }),
  z.object({ action: z.literal("send-list"), refereeIds: z.array(z.string().uuid()).optional() })
]);

/** Arbitres (admin seulement) : liste des arbitres, postes ouverts, coûts des matchs, paiements. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  try {
    const b = schema.parse(await request.json());
    switch (b.action) {
      case "add-referee": {
        const r = await addReferee({ ...b, status: "actif" });
        if (b.sendLink) await sendWelcomeEmail(r);
        return NextResponse.json({ ok: true });
      }
      case "referee-status": {
        const before = (await listReferees()).find((r) => r.id === b.id);
        await updateReferee(b.id, { status: b.status });
        if (before && before.status === "en_attente" && b.status === "actif") await sendWelcomeEmail({ ...before, status: "actif" });
        return NextResponse.json({ ok: true });
      }
      case "open-all":
        return NextResponse.json({ ok: true, opened: await openAllUpcoming() });
      case "open-match":
        return NextResponse.json({ ok: true, opened: await openPositions(b.slotId) });
      case "costs": {
        const patch: Record<string, number> = {};
        if (b.refereesNeeded !== undefined) patch.referees_needed = b.refereesNeeded;
        if (b.refereeFeeCents !== undefined) patch.referee_fee_cents = b.refereeFeeCents;
        if (b.fieldCostCents !== undefined) patch.field_cost_cents = b.fieldCostCents;
        if (b.coachCostCents !== undefined) patch.coach_cost_cents = b.coachCostCents;
        await updateMatchCosts(b.slotId, patch);
        return NextResponse.json({ ok: true });
      }
      case "release":
        await releaseAssignment(b.assignmentId);
        return NextResponse.json({ ok: true });
      case "cancel":
        await cancelAssignment(b.assignmentId);
        return NextResponse.json({ ok: true });
      case "paid":
        await markPaid(b.assignmentId, b.note);
        return NextResponse.json({ ok: true });
      case "send-list":
        return NextResponse.json({ ok: true, ...(await sendOpenMatchesEmail(b.refereeIds)) });
    }
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    console.error("Referees POST failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}

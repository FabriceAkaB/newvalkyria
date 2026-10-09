import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import {
  addSponsorPayment,
  createSponsor,
  deleteSponsor,
  deleteSponsorPayment,
  getSponsorPayments,
  getSponsors,
  updateSponsor,
  updateSponsorPayment,
  type SponsorInput
} from "@/lib/sponsors-repo";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const [sponsors, payments] = await Promise.all([getSponsors(), getSponsorPayments()]);
  return NextResponse.json({ sponsors, payments });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, any> | null;
  if (!body?.action) return jsonError("Action requise", 400);
  try {
    switch (body.action) {
      case "create":
        return NextResponse.json({ ok: true, id: await createSponsor(body.sponsor as SponsorInput) });
      case "update":
        await updateSponsor(body.id, body.sponsor as SponsorInput);
        break;
      case "delete":
        await deleteSponsor(body.id);
        break;
      case "payment_add":
        await addSponsorPayment({ sponsorId: body.sponsorId, amountCents: Math.round(Number(body.amountCents)), dueDate: body.dueDate, paidAt: body.paidAt, method: body.method, note: body.note });
        break;
      case "payment_update":
        await updateSponsorPayment(body.id, { paidAt: body.paidAt, dueDate: body.dueDate });
        break;
      case "payment_delete":
        await deleteSponsorPayment(body.id);
        break;
      default:
        return jsonError("Action inconnue", 400);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}

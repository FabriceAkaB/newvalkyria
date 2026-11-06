import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { startPlanCardSession } from "@/lib/plan-card";

export const dynamic = "force-dynamic";

/** Lien permanent envoyé au parent : ouvre une page Stripe neuve pour enregistrer la carte des versements à venir. */
export async function GET(_request: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const r = await startPlanCardSession(planId).catch(() => ({ error: "Stripe indisponible, réessayez dans un moment." }));
  if ("url" in r) return NextResponse.redirect(r.url, 303);
  if ("done" in r) return NextResponse.redirect(`${env.publicSiteUrl}/confirmation?carte=true`, 303);
  return new NextResponse(`${r.error} Écrivez-nous à info@newvalkyria.com.`, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
}

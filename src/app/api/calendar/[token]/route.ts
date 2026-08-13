import { NextResponse } from "next/server";

import { getUnifiedCalendarEvents, verifyCalendarFeedToken } from "@/lib/calendar-repo";
import { generateICS } from "@/lib/ical";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Flux d'abonnement iCal public (protégé par jeton secret dans l'URL,
 *  même principe que les liens de calendrier privés Google/Apple — pas
 *  d'authentification interactive possible pour un abonnement de calendrier). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/i, "");

  const valid = await verifyCalendarFeedToken(token);
  if (!valid) return new NextResponse("Jeton invalide", { status: 404 });

  const today = new Date();
  const from = isoDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
  const to = isoDate(new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000));

  const events = await getUnifiedCalendarEvents(from, to);
  const ics = generateICS(events);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=new-valkyria.ics",
      "Cache-Control": "public, max-age=1800"
    }
  });
}

import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";

/** Ce que le menu du portail doit montrer pour cet éducateur (ex. l'espace vidéaste). */
export async function GET() {
  const coachId = await getCurrentCoachId();
  if (!coachId) return NextResponse.json({ videographer: false, connected: false });
  const coach = await getCoach(coachId);
  return NextResponse.json({ videographer: Boolean(coach?.is_videographer), connected: true });
}

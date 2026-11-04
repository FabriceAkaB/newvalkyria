import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/http";
import { sendRefereeLink } from "@/lib/referees-repo";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email().max(160), website: z.string().max(0).optional() });

/** « J'ai perdu mon lien » : renvoie le lien personnel à un arbitre approuvé. Même réponse que le courriel soit connu ou non. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Courriel invalide.");
  await sendRefereeLink(parsed.data.email).catch((err) => console.error("Referee link resend failed", err));
  return NextResponse.json({ ok: true });
}

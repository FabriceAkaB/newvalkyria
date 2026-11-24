import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import type { TournamentAnswer } from "@/lib/tournaments-core";
import { setResponseByToken, setResponseFromPrivatePage } from "@/lib/tournaments-repo";

/** Réponse d'une famille depuis la page à lien privé /tournois : par son lien personnel (?r=…), ou par le nom de la
 *  joueuse et le courriel de son inscription. */
const ANSWERS: TournamentAnswer[] = ["interessee", "disponible", "pas_cette_fois"];

export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as { slug?: string; token?: string; firstName?: string; lastName?: string; parentEmail?: string; answer?: string } | null;
  const answer = b?.answer as TournamentAnswer;
  if (!b || !ANSWERS.includes(answer)) return jsonError("Choisissez une réponse.", 400);
  try {
    const res = b.token
      ? await setResponseByToken(String(b.token), answer)
      : b.slug && b.firstName?.trim() && b.parentEmail?.trim()
        ? await setResponseFromPrivatePage({ slug: String(b.slug), firstName: b.firstName, lastName: b.lastName ?? "", parentEmail: b.parentEmail, answer })
        : { ok: false as const, error: "Indiquez le prénom et le nom de votre fille et votre courriel." };
    if (!res.ok) return jsonError(res.error, 422);
    return NextResponse.json({ ok: true, answer: res.row.response, offerStatus: res.row.offerStatus });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 500);
  }
}

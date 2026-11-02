import { NextResponse } from "next/server";
import { z } from "zod";

import { OWNER_NOTIFY_EMAIL } from "@/lib/email";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { addReferee } from "@/lib/referees-repo";
import { getResendClient, isEmailConfigured } from "@/lib/resend";

export const dynamic = "force-dynamic";

const schema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(30),
  level: z.string().trim().max(80).optional(),
  interacEmail: z.string().trim().max(120).optional(),
  website: z.string().max(0).optional() // piège à robots
});

/** Inscription d'un arbitre : il est « en attente » jusqu'à ce que JP l'approuve dans l'admin. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Vérifiez vos informations (nom, courriel, téléphone).");
  const d = parsed.data;
  try {
    await addReferee({ firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, level: d.level || null, interacEmail: d.interacEmail || null, status: "en_attente" });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 409);
  }
  if (isEmailConfigured()) {
    await getResendClient()
      .emails.send({
        from: env.resendFrom,
        to: OWNER_NOTIFY_EMAIL,
        subject: `Nouvel arbitre à approuver : ${d.firstName} ${d.lastName}`,
        html: `<p><strong>${d.firstName} ${d.lastName}</strong> (${d.email}, ${d.phone}${d.level ? `, ${d.level}` : ""}) veut arbitrer nos matchs.</p><p><a href="${env.publicSiteUrl}/admin/arbitres">Approuver dans l'admin</a> : il recevra son lien pour réserver des matchs.</p>`
      })
      .catch(() => null);
  }
  return NextResponse.json({ ok: true });
}

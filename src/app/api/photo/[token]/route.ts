import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getPlayerByPhotoToken, setImageConsent, uploadPlayerPhoto } from "@/lib/players-repo";

const MAX_SIZE = 10 * 1024 * 1024;

/** La famille dépose la photo de sa fille avec son lien personnel, et donne (ou non) l'accord de publication. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const player = await getPlayerByPhotoToken(token);
  if (!player) return jsonError("Ce lien n'est plus valide. Écrivez-nous à info@newvalkyria.com.", 404);

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  const consent = form?.get("consent") === "oui";
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return jsonError("Choisissez une photo (JPG, PNG ou HEIC).", 400);
    if (file.size > MAX_SIZE) return jsonError("La photo dépasse 10 Mo : prenez-en une plus légère.", 413);
    await uploadPlayerPhoto(player.id, file);
  } else if (!player.hasPhoto) {
    return jsonError("Ajoutez la photo de votre fille.", 400);
  }
  if (consent !== player.imageConsent) await setImageConsent(player.id, consent);
  return NextResponse.json({ ok: true });
}

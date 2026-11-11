import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { completeUpload, startUpload } from "@/lib/valkyria-lab";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  // Étape 1 : la famille a choisi la joueuse, le geste et la vidéo ; on prépare un lien de téléversement signé.
  z.object({
    action: z.literal("start"),
    player: z.string().min(1).max(140),
    gesture: z.string().min(1).max(80),
    fileName: z.string().min(1).max(255),
    size: z.number().int().positive(),
    type: z.string().max(100).nullable()
  }),
  // Étape 2 : le navigateur a téléversé le fichier directement dans le stockage privé.
  z.object({ action: z.literal("complete"), path: z.string().min(10).max(400), player: z.string().min(1).max(140), gesture: z.string().min(1).max(80) })
]);

/** « Envoyer ma vidéo » (Valkyria Lab, lien personnel de la famille). Le fichier ne passe jamais par ce serveur. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return jsonError("Lien invalide", 404);
  try {
    const b = schema.parse(await request.json());
    if (b.action === "start") return NextResponse.json({ ok: true, ...(await startUpload(token, b)) });
    return NextResponse.json({ ok: true, ...(await completeUpload(token, b)) });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Envoi invalide. Recommencez.");
    console.error("Valkyria Lab envoi", err);
    return jsonError(err instanceof Error ? err.message : "Erreur, réessayez dans un instant.", 400);
  }
}

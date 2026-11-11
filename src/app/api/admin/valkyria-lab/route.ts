import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import {
  COMMENT_MAX,
  deleteRoutine,
  deleteSubmission,
  markSeen,
  markUnseen,
  saveRoutine,
  sendLabLinks,
  setAccessActive,
  setRoutineStatus,
  syncFamilies,
  watchUrl
} from "@/lib/valkyria-lab";

export const dynamic = "force-dynamic";
// L'envoi du lien à toutes les familles part un courriel à la fois.
export const maxDuration = 300;

const text = (max: number) => z.string().max(max).nullable().optional();
const url = z.string().max(500).nullable().optional();
const routine = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  title: z.string().max(120),
  instructions: text(2000),
  exercises: z.array(z.object({ name: z.string().max(60), how: text(600), videoUrl: url })).max(12),
  challenge: text(600),
  challengeVideoUrl: url,
  weeklyGames: z.array(z.object({ title: z.string().max(80), how: text(600), videoUrl: url })).max(5)
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save-routine"), routine, publish: z.boolean().nullable() }),
  z.object({ action: z.literal("routine-status"), id: z.string().uuid(), status: z.enum(["brouillon", "publie"]) }),
  z.object({ action: z.literal("delete-routine"), id: z.string().uuid() }),
  z.object({ action: z.literal("sync-families") }),
  z.object({ action: z.literal("send-links"), scope: z.enum(["unsent", "all", "ids"]), ids: z.array(z.string().uuid()).max(500).optional() }),
  z.object({ action: z.literal("access-active"), id: z.string().uuid(), active: z.boolean() }),
  z.object({ action: z.literal("watch"), id: z.string().uuid(), download: z.boolean().optional() }),
  z.object({ action: z.literal("mark-seen"), id: z.string().uuid(), comment: z.string().max(COMMENT_MAX).nullable(), notify: z.boolean() }),
  z.object({ action: z.literal("mark-unseen"), id: z.string().uuid() }),
  z.object({ action: z.literal("delete-video"), id: z.string().uuid() })
]);

/** Valkyria Lab (admin seulement) : routine du mois, liens des familles, vidéos reçues. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  try {
    const b = schema.parse(await request.json());
    switch (b.action) {
      case "save-routine": {
        const r = await saveRoutine(b.routine, b.publish);
        return NextResponse.json({ ok: true, id: r.id, status: r.status });
      }
      case "routine-status":
        await setRoutineStatus(b.id, b.status);
        return NextResponse.json({ ok: true });
      case "delete-routine":
        await deleteRoutine(b.id);
        return NextResponse.json({ ok: true });
      case "sync-families":
        return NextResponse.json({ ok: true, ...(await syncFamilies()) });
      case "send-links":
        if (b.scope === "ids" && !b.ids?.length) return jsonError("Aucune famille choisie");
        return NextResponse.json({ ok: true, ...(await sendLabLinks({ scope: b.scope, ids: b.ids })) });
      case "access-active":
        await setAccessActive(b.id, b.active);
        return NextResponse.json({ ok: true });
      case "watch":
        return NextResponse.json({ ok: true, url: await watchUrl(b.id, b.download ?? false) });
      case "mark-seen":
        return NextResponse.json({ ok: true, ...(await markSeen(b.id, b.comment, b.notify)) });
      case "mark-unseen":
        await markUnseen(b.id);
        return NextResponse.json({ ok: true });
      case "delete-video":
        await deleteSubmission(b.id);
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    if (err instanceof ZodError) return jsonError(err.issues[0]?.message ?? "Données invalides");
    console.error("Valkyria Lab admin", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}

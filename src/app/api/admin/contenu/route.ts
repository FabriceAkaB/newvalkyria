import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { addInterviews, addSlot, deleteInterview, deleteSlot, inviteInterviews, setCapture, updateInterview } from "@/lib/content-repo";
import { jsonError } from "@/lib/http";
import { deleteShoot, saveShoot, setShootStatus } from "@/lib/video-shoots-repo";
import { shootActions } from "@/lib/video-shoots-schema";

export const dynamic = "force-dynamic";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{1,2}:\d{2}$/);
const interviewStatus = z.enum(["a_inviter", "invitee", "confirmee", "filmee", "montee", "publiee", "decline"]);

const schema = z.discriminatedUnion("action", [
  ...shootActions,
  z.object({ action: z.literal("capture"), activityId: z.string().uuid(), kind: z.enum(["ball_mastery_360", "photos_match"]), done: z.boolean(), url: z.string().max(500).nullable().optional(), filmedBy: z.string().max(80).nullable().optional(), note: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal("slot-add"), day: date, startTime: time, endTime: time, place: z.string().min(2).max(200), capacity: z.number().int().min(1).max(40), note: z.string().max(300).nullable().optional() }),
  z.object({ action: z.literal("slot-delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("interview-add"), registrationIds: z.array(z.string().uuid()).min(1).max(200), kind: z.enum(["debut", "fin"]), withParent: z.boolean() }),
  z.object({ action: z.literal("interview-update"), id: z.string().uuid(), status: interviewStatus.optional(), slotId: z.string().uuid().nullable().optional(), videoUrl: z.string().max(500).nullable().optional(), note: z.string().max(1000).nullable().optional() }),
  z.object({ action: z.literal("interview-delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("interview-invite"), ids: z.array(z.string().uuid()).min(1).max(200) })
]);

/** Espace Création de contenu (admin et gérante) : tournages et calendrier de publication, ball mastery à 360°
 *  et photos de match, journées d'entrevues, entrevues et invitations aux familles. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin" && role !== "gerante") return jsonError("Non autorisé", 401);
  const by = role === "admin" ? "JP" : "Gérante";
  try {
    const body = schema.parse(await request.json());
    switch (body.action) {
      case "shoot-save":
        await saveShoot(body);
        break;
      case "shoot-status":
        await setShootStatus(body.id, body.status);
        break;
      case "shoot-delete":
        await deleteShoot(body.id);
        break;
      case "capture":
        await setCapture(body);
        break;
      case "slot-add":
        await addSlot(body);
        break;
      case "slot-delete":
        await deleteSlot(body.id);
        break;
      case "interview-add": {
        const added = await addInterviews(body.registrationIds, body.kind, body.withParent);
        return NextResponse.json({ ok: true, added });
      }
      case "interview-update":
        await updateInterview(body.id, body);
        break;
      case "interview-delete":
        await deleteInterview(body.id);
        break;
      case "interview-invite": {
        const r = await inviteInterviews(body.ids);
        await logAudit({ actorRole: role, actorLabel: by, action: "content_interview_invite", entityType: "content_interviews", entityId: body.ids[0], entityLabel: `Invitations aux entrevues filmées (${r.sent} familles)`, after: r }).catch(() => null);
        return NextResponse.json({ ok: true, ...r });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    console.error("Contenu POST failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}

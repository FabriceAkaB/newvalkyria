import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import {
  AUDIENCE_LABEL,
  addInvites,
  createSurvey,
  deleteSurvey,
  getAudience,
  removeInvite,
  sendInvites,
  setFollowup,
  updateSurvey,
  type AudienceKey
} from "@/lib/surveys-repo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const question = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  type: z.enum(["note10", "echelle5", "choix", "choix_multiple", "oui_non", "texte"]),
  label: z.string().min(2).max(300),
  help: z.string().max(200).optional(),
  options: z.array(z.string().min(1).max(120)).max(12).optional(),
  required: z.boolean().optional(),
  role: z.enum(["recommandation", "interet"]).optional()
});
const audience = z.array(z.enum(["saison", "garcons", "sport-etudes", "ete"])).min(1);

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), kind: z.enum(["mi-saison", "fin-saison", "bulletin", "changement", "interet", "lab", "autre"]), title: z.string().max(160).optional() }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    title: z.string().min(2).max(160).optional(),
    intro: z.string().max(3000).optional(),
    questions: z.array(question).min(1).max(30).optional(),
    projectLabel: z.string().max(160).nullable().optional(),
    closesOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    status: z.enum(["brouillon", "envoye", "ferme"]).optional()
  }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("audience"), audience }),
  z.object({ action: z.literal("add-invites"), id: z.string().uuid(), audience, exclude: z.array(z.string()).max(1000).optional() }),
  z.object({ action: z.literal("remove-invite"), inviteId: z.string().uuid() }),
  z.object({ action: z.literal("send"), id: z.string().uuid(), reminder: z.boolean(), inviteIds: z.array(z.string().uuid()).optional() }),
  z.object({ action: z.literal("followup"), responseId: z.string().uuid(), status: z.enum(["aucun", "a_appeler", "appele", "regle"]), note: z.string().max(1000).nullable() })
]);

/** Voix des familles (admin seulement) : créer un sondage, choisir les familles, envoyer, relancer, suivre. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  try {
    const b = schema.parse(await request.json());
    switch (b.action) {
      case "create":
        return NextResponse.json({ ok: true, id: await createSurvey({ kind: b.kind, title: b.title }) });
      case "update": {
        const patch: Record<string, unknown> = {};
        if (b.title !== undefined) patch.title = b.title;
        if (b.intro !== undefined) patch.intro = b.intro;
        if (b.questions !== undefined) {
          const ids = new Set(b.questions.map((q) => q.id));
          if (ids.size !== b.questions.length) return jsonError("Deux questions ont le même identifiant.");
          patch.questions = b.questions;
        }
        if (b.projectLabel !== undefined) patch.project_label = b.projectLabel;
        if (b.closesOn !== undefined) patch.closes_on = b.closesOn;
        if (b.status !== undefined) patch.status = b.status;
        await updateSurvey(b.id, patch);
        return NextResponse.json({ ok: true });
      }
      case "delete":
        await deleteSurvey(b.id);
        return NextResponse.json({ ok: true });
      case "audience": {
        const families = await getAudience(b.audience as AudienceKey[]);
        return NextResponse.json({ ok: true, families });
      }
      case "add-invites": {
        const exclude = new Set((b.exclude ?? []).map((e) => e.toLowerCase()));
        const families = (await getAudience(b.audience as AudienceKey[])).filter((f) => !exclude.has(f.email));
        const added = await addInvites(b.id, families, (b.audience as AudienceKey[]).map((k) => AUDIENCE_LABEL[k]).join(" + "));
        return NextResponse.json({ ok: true, added });
      }
      case "remove-invite":
        await removeInvite(b.inviteId);
        return NextResponse.json({ ok: true });
      case "send":
        return NextResponse.json({ ok: true, ...(await sendInvites(b.id, { reminder: b.reminder, inviteIds: b.inviteIds })) });
      case "followup":
        await setFollowup(b.responseId, b.status, b.note);
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    console.error("Surveys POST failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}

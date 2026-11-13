import { z } from "zod";

/** Actions des tournages, partagées par l'espace JP (/api/admin/moi) et l'espace Contenu (/api/admin/contenu). */
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const status = z.enum(["idee", "planifie", "tourne", "monte", "publie"]);

export const shootActions = [
  z.object({
    action: z.literal("shoot-save"),
    id: z.string().uuid().optional(),
    title: z.string().min(2).max(300),
    series: z.string().min(2).max(40),
    status: status.optional(),
    shootOn: date.nullable().optional(),
    shootTime: z.string().max(40).nullable().optional(),
    place: z.string().max(300).nullable().optional(),
    message: z.string().max(1000).nullable().optional(),
    hook: z.string().max(1000).nullable().optional(),
    shots: z.string().max(4000).nullable().optional(),
    people: z.string().max(500).nullable().optional(),
    gear: z.string().max(500).nullable().optional(),
    format: z.string().max(60).nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
    publishOn: date.nullable().optional(),
    postKind: z.enum(["organique", "essai", "pub"]).nullable().optional(),
    angle: z.string().max(200).nullable().optional(),
    networks: z.array(z.string().max(20)).max(6).nullable().optional(),
    filmedBy: z.string().max(80).nullable().optional()
  }),
  z.object({ action: z.literal("shoot-status"), id: z.string().uuid(), status }),
  z.object({ action: z.literal("shoot-delete"), id: z.string().uuid() })
] as const;

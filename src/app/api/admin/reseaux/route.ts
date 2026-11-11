import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { FOLLOWER_NETWORKS, POST_URL_RE, localDay, postLabel } from "@/lib/marketing-posts-core";
import { addAdSpend, addFollowers, addPost, deletePost, updatePost } from "@/lib/marketing-posts";

export const dynamic = "force-dynamic";

/** AAAA-MM-JJ qui existe vraiment au calendrier (pas de 2026-02-31). */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .refine((d) => {
    const t = Date.parse(`${d}T12:00:00Z`);
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
  }, "Date invalide");
/** Un relevé (abonnés, campagne) se fait aujourd'hui ou avant, à l'heure de Montréal. */
const pastDay = day.refine((d) => d <= localDay(new Date()), "La date du relevé ne peut pas être dans le futur");
const count = z.number().int().min(0).max(100_000_000).nullable().optional();
const text = (max: number) => z.string().max(max).nullable().optional();
const network = z.enum(["instagram", "facebook", "youtube", "tiktok", "autre"]);
const format = z.enum(["reel", "video", "carrousel", "photo", "story", "texte"]);

const stats = {
  views: count,
  likes: count,
  comments: count,
  shares: count,
  saves: count,
  followersGained: z.number().int().min(-1_000_000).max(10_000_000).nullable().optional(),
  spendCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  leads: count,
  registrations: count
};
const details = {
  format,
  paid: z.boolean(),
  postedOn: day,
  // http(s) seulement : z.string().url() accepte « javascript:… », qui finirait dans un href.
  url: z.string().max(500).regex(POST_URL_RE, "Lien invalide : il doit commencer par https://").nullable().optional().or(z.literal("")),
  title: text(160),
  theme: text(60),
  note: text(500)
};

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add-post"), networks: z.array(network).min(1, "Choisissez au moins un réseau").max(5), ...details, ...stats }),
  z.object({ action: z.literal("update-post"), id: z.number().int().positive(), ...details, ...stats }),
  z.object({ action: z.literal("delete-post"), id: z.number().int().positive() }),
  z.object({
    action: z.literal("followers"),
    measuredAt: pastDay.optional(),
    entries: z
      .array(z.object({ network: z.enum(FOLLOWER_NETWORKS), followers: z.number().int().min(0).max(100_000_000) }))
      .min(1, "Entrez au moins un nombre d'abonnés")
      .max(FOLLOWER_NETWORKS.length)
  }),
  z.object({
    action: z.literal("ad-spend"),
    channel: z.enum(["pub_meta", "pub_google"]),
    measuredAt: pastDay.optional(),
    spendCents: z.number().int().min(1, "Entrez le montant dépensé").max(100_000_000),
    leads: count,
    note: text(200)
  })
]);

/** Réseaux sociaux (admin seulement) : publications, abonnés par réseau et campagnes de pub. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  try {
    const b = schema.parse(await request.json());
    switch (b.action) {
      case "add-post": {
        const r = await addPost({ ...b, url: b.url || null });
        return NextResponse.json({ ok: true, ...r });
      }
      case "update-post":
        if (!(await updatePost(b.id, { ...b, url: b.url || null }))) return jsonError("Publication introuvable : elle a peut-être déjà été supprimée.", 404);
        return NextResponse.json({ ok: true });
      case "delete-post": {
        const before = await deletePost(b.id);
        if (!before) return jsonError("Publication introuvable : elle a peut-être déjà été supprimée.", 404);
        await logAudit({ actorRole: "admin", actorLabel: "JP", action: "delete", entityType: "marketing_post", entityId: String(b.id), entityLabel: postLabel(before), before }).catch(
          () => undefined
        );
        return NextResponse.json({ ok: true });
      }
      case "followers":
        return NextResponse.json({ ok: true, saved: await addFollowers(b.entries, b.measuredAt) });
      case "ad-spend":
        await addAdSpend(b);
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    if (err instanceof ZodError) return jsonError(err.issues[0]?.message ?? "Données invalides", 400);
    console.error("[admin/reseaux]", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}
